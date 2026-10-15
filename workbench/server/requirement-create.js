import { promises as fs } from "node:fs";
import path from "node:path";
import { renderRequirementPool, validateWorkflowData } from "../../../cx回收/prototype/scripts/workflow-data.mjs";
import { getRequirementTemplate, templateSnapshot } from "../src/requirement-templates.js";
import {initialLifecycle} from "../src/requirement-lifecycle.js";

const CHECKS = ["goal-clear", "scope-clear", "acceptance-testable", "dependencies-clear", "rules-confirmed", "authorization-confirmed", "risk-reviewed"];
const DEFERRED = ["decision", "plan", "contract", "prototype", "page-guide", "test-report", "review-report", "user-confirmation", "commit", "release"];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 30000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > limit) reject(Object.assign(new Error("请求内容过长"), { statusCode: 413 }));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function nextRequirementId(requirements) {
  const max = requirements.reduce((value, item) => {
    const match = /^CR-(\d+)$/.exec(item.id || "");
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `CR-${String(max + 1).padStart(3, "0")}`;
}

export function makeRequirementRecord({ id, description, materials, requestId, template, impactTags=template.defaultImpactTags, now = new Date() }) {
  const iso = now.toISOString();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const firstLine = description.split(/\r?\n/).find(line => line.trim())?.trim() || description.trim();
  const title = [...firstLine].slice(0, 40).join("");
  const notes = [description.trim()];
  if (materials.trim()) notes.push(`补充材料：${materials.trim()}`);
  notes.push("本次仅登记，等待产品经理明确启动；未启动 AI，未修改原型、页面说明、业务决策或项目实现。");
  return {
    id, title, proposedAt: date, currentStageId: "waiting-start",
    stageResults: {
      registered: { status: "completed", updatedAt: date, recordedAt: iso, note: "用户通过本机工作台正式登记需求。" },
      "waiting-start": { status: "waiting_user", updatedAt: date, recordedAt: iso, note: "需求仅登记，等待产品经理明确启动分析；未授权修改任何项目内容。" },
    },
    pendingQuestions: [], notes,
    impact: { surfaces: [], pageIds: [], actionIds: [], stateIds: [] },
    decisionIds: [], documents: [],
    evidence: [{ type: "note", reference: `用户于 ${iso} 通过本机工作台登记 ${id}；仅登记，未启动 AI 或实施。` }],
    taskControl: {
      executionState: "locked", aiPolicy: "unassessed",
      readinessChecklist: CHECKS.map(checkId => ({ id: checkId, status: "not-assessed", evidence: [] })),
      waitingReason: null,
      executionScope: { mode: "record-only", label: "仅登记，等待用户明确启动", allowedArtifactTypes: [], deferredArtifactTypes: DEFERRED, authorizationBasis: [`registry:${id}.stageResults.waiting-start`] },
    },
    artifacts: [], confirmedAt: null,
    requirementType: template.id,
    impactTags: [...impactTags],
    workbenchLifecycle: initialLifecycle(iso),
    workbenchTemplate: {...templateSnapshot(template), appliedAt: iso, version: 1},
    workbenchRegistration: { requestId, registeredAt: iso, mode: "record-only", templateId: template.id },
  };
}

export function requirementCreatePlugin(projectRoot, runtimeRoot) {
  const registryPath = path.join(projectRoot, "docs/requirements/registry.json");
  const pageMapPath = path.join(projectRoot, "docs/requirements/page-document-map.json");
  const poolPath = path.join(projectRoot, "docs/需求池.md");
  const lockPath = path.join(runtimeRoot, "requirement-create.lock");
  return { name: "requirement-create", configureServer(server) {
    server.middlewares.use("/api/requirements/cx-recycle", async (req, res) => {
      if (req.method !== "POST" || (req.url !== "/" && req.url !== "")) return json(res, 404, { error: "not found" });
      let locked = false;
      try {
        if (!String(req.headers["content-type"] || "").startsWith("application/json")) return json(res, 415, { error: "请使用 JSON 提交" });
        const payload = JSON.parse(await readBody(req));
        const description = typeof payload.description === "string" ? payload.description.trim() : "";
        const materials = typeof payload.materials === "string" ? payload.materials.trim() : "";
        const template = getRequirementTemplate(payload.templateId);
        if (payload.projectId !== "cx-recycle" || payload.confirmRecordOnly !== true) return json(res, 400, { error: "项目或登记边界未确认" });
        if (!template) return json(res, 400, { error: "请选择有效的需求类型" });
        const allowedTags=new Set(["frontend-page","backend-logic","state-data","external-interface","requirement-document"]);
        const impactTags=payload.impactTags===undefined?template.defaultImpactTags:payload.impactTags;
        if(!Array.isArray(impactTags)||impactTags.some(tag=>!allowedTags.has(tag))||new Set(impactTags).size!==impactTags.length||
          (template.id==="existing-page-adjustment"&&!impactTags.includes("frontend-page")))
          return json(res,400,{error:"请核对影响范围；现有页面调整必须标记前端页面。"});
        if (!/^[0-9a-f-]{36}$/i.test(payload.requestId || "")) return json(res, 400, { error: "登记请求无效" });
        if (description.length < 2 || description.length > 5000 || materials.length > 10000) return json(res, 400, { error: "请填写 2–5000 字需求描述，补充材料不超过 10000 字" });
        await fs.mkdir(runtimeRoot, { recursive: true });
        try { await fs.writeFile(lockPath, payload.requestId, { flag: "wx" }); locked = true; }
        catch (error) { if (error.code === "EEXIST") return json(res, 409, { error: "另一条需求正在登记，请稍后刷新台账核查" }); throw error; }
        const [registryText, poolText, pageMapText] = await Promise.all([fs.readFile(registryPath, "utf8"), fs.readFile(poolPath, "utf8"), fs.readFile(pageMapPath, "utf8")]);
        const registry = JSON.parse(registryText);
        const existing = registry.requirements.find(item => item.workbenchRegistration?.requestId === payload.requestId);
        if (existing) return json(res, 200, { ok: true, requirement: { id: existing.id, title: existing.title }, repeated: true });
        const id = nextRequirementId(registry.requirements);
        const record = makeRequirementRecord({ id, description, materials, requestId: payload.requestId, template, impactTags });
        registry.requirements.push(record);
        const validation = await validateWorkflowData(registry, JSON.parse(pageMapText));
        if (!validation.valid) return json(res, 422, { error: "新需求未通过台账校验", details: validation.errors });
        const nextRegistry = `${JSON.stringify(registry, null, 2)}\n`;
        const nextPool = renderRequirementPool(registry);
        const registryTemp = `${registryPath}.${payload.requestId}.tmp`;
        const poolTemp = `${poolPath}.${payload.requestId}.tmp`;
        await fs.writeFile(registryTemp, nextRegistry, "utf8");
        await fs.writeFile(poolTemp, nextPool, "utf8");
        try {
          await fs.rename(registryTemp, registryPath);
          await fs.rename(poolTemp, poolPath);
        } catch (error) {
          await Promise.all([fs.writeFile(registryPath, registryText, "utf8"), fs.writeFile(poolPath, poolText, "utf8")]);
          await Promise.allSettled([fs.unlink(registryTemp), fs.unlink(poolTemp)]);
          throw error;
        }
        return json(res, 201, { ok: true, requirement: { id, title, templateId: template.id }, state: "waiting-start", message: "需求已登记，尚未启动 AI 或实施。" });
      } catch (error) {
        return json(res, error.statusCode || 500, { error: error instanceof SyntaxError ? "提交内容无法读取" : "登记失败，项目台账未更新" });
      } finally {
        if (locked) await fs.unlink(lockPath).catch(() => {});
      }
    });
  }};
}
