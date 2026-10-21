import path from "node:path";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { safePath } from "./safe-path.mjs";
import { fingerprintSources, evaluateFreshness } from "./source-fingerprint.mjs";
import {
  fingerprintDocumentBaselineEntries,
  selectDocumentBaselineEntries,
} from "./documents-validate.mjs";
import { deriveStatusCard } from "./workflow-v3-lib.mjs";
import { parseOptions } from "./cli-lib.mjs";
const array = (x) => (Array.isArray(x) ? x : []);
const hash = (x) => createHash("sha256").update(x).digest("hex");
const local = (p) => typeof p === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(p);
export async function createTaskContext({ root, cr, task, scenario, budget = 20 * 1024 }) {
  if ([cr, task, scenario].filter(Boolean).length !== 1)
    throw new Error("必须且只能指定 --cr、--task 或 --scenario");
  const read = async (p) => JSON.parse(await fs.readFile(safePath(root, p), "utf8"));
  const config = await read("project.config.json"),
    status = await read("project-status.json");
  const refs = new Set(["AGENTS.md", "project.config.json", "project-status.json"]);
  let selected,
    scope,
    acceptance,
    questions,
    authorization = [],
    allowedAction = "read-only",
    nextAction,
    materials = [],
    documentBaselineSelection = null;
  if (cr) {
    if (status.currentMode !== "continuous-iteration")
      throw new Error("快速验证不使用 CR，请指定 --scenario");
    const source = config.paths.requirements;
    refs.add(source);
    selected = array((await read(source)).items).find((i) => i?.id === cr);
    if (!selected) throw new Error(`未找到需求：${cr}`);
    scope = selected.executionScope;
    acceptance = selected.acceptanceCriteria;
    questions = selected.openQuestions;
    authorization =
      array(selected.readinessChecklist).find((c) => c.id === "authorization-confirmed")
        ?.evidence || [];
    nextAction = deriveStatusCard(selected).nextAction;
    // A context packet never elevates execution permission; the current gate must be rechecked.
    allowedAction =
      selected.aiPolicy === "planning-only" &&
      ["ready", "in-progress"].includes(selected.executionState)
        ? "planning"
        : "read-only";
    const documentReferences = array(selected.documents);
    if (config.paths?.documentBaseline) {
      const baselinePath = config.paths.documentBaseline;
      let baseline;
      try {
        baseline = await read(baselinePath);
      } catch (error) {
        throw new Error(`无法读取已启用的文档基线 ${baselinePath}：${error.message}`);
      }
      const entries = selectDocumentBaselineEntries(baseline, documentReferences);
      documentBaselineSelection = {
        path: baselinePath,
        references: documentReferences,
        entries,
        selectionFingerprint: fingerprintDocumentBaselineEntries(entries),
      };
      for (const entry of entries) {
        if (local(entry.locator)) refs.add(entry.locator.split("#")[0]);
        if (entry.snapshotPath) refs.add(entry.snapshotPath);
      }
    }
    for (const p of [
      ...array(selected.evidence).map((e) => e.location),
      ...array(selected.artifacts).map((e) => e.location),
    ])
      if (local(p)) refs.add(p.split("#")[0]);
    for (const p of documentReferences) {
      const matched = documentBaselineSelection?.entries.some(
        (entry) => entry.id === p || entry.locator.split("#")[0] === p.split("#")[0],
      );
      if (!matched && local(p)) refs.add(p.split("#")[0]);
    }
  } else if (task) {
    if (status.capabilities?.developmentHandoff?.enabled !== true)
      throw new Error("未启用产研交接");
    const source = config.paths.developmentHandoff;
    refs.add(source);
    const handoff = await read(source);
    const { validateDevelopmentHandoff } = await import("./development-handoff-lib.mjs");
    const errors = validateDevelopmentHandoff(handoff);
    if (errors.length || handoff.status !== "formal")
      throw new Error(`任务清单未形成有效正式基线：${errors.join("；")}`);
    selected = array(handoff.tasks).find((t) => t.id === task);
    if (!selected) throw new Error(`未找到任务：${task}`);
    scope = {
      objective: selected.developmentScope,
      included: [selected.developmentScope],
      excluded: handoff.explicitExclusions,
    };
    acceptance = selected.acceptanceCriteria;
    questions = [];
    nextAction = "核对当前任务材料、前置条件及实施授权";
    const materialIds = new Set(array(selected.materialRefs).map((r) => r.materialId));
    materials = array(handoff.materials)
      .filter((m) => materialIds.has(m.id))
      .map((m) => ({
        id: m.id,
        locator: m.locator,
        section: m.section,
        revision: m.revisionLabel,
      }));
    for (const m of materials) if (local(m.locator)) refs.add(m.locator.split("#")[0]);
  } else {
    if (status.currentMode !== "rapid-validation")
      throw new Error("评审场景上下文仅适用于快速验证");
    const source = config.paths.reviewScenarios || "prototype/src/review-scenarios.json";
    refs.add(source);
    selected = array((await read(source)).scenarios).find((s) => s.id === scenario);
    if (!selected) throw new Error(`未找到评审场景：${scenario}`);
    scope = {
      objective: selected.validationQuestion,
      included: [selected.expectedResult],
      excluded: status.validationProfile?.inputSufficiency?.mustNotDo || [],
    };
    acceptance = [selected.expectedResult];
    questions = status.validationProfile?.inputSufficiency?.requiresConfirmation || [];
    nextAction = "核对场景范围与当前授权";
  }
  // Expand static local code dependencies without outputting unrelated records.
  const queue = [...refs];
  const scanned = new Set();
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i];
    if (scanned.has(file) || !/\.(?:m?js|jsx|ts|tsx|css)$/.test(file)) continue;
    scanned.add(file);
    let content;
    try {
      content = await fs.readFile(safePath(root, file), "utf8");
    } catch (e) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    for (const match of content.matchAll(
      /(?:from\s*|import\s*\(?|@import\s*)["'](\.[^"']+)["']/g,
    )) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
      const candidates = [
        resolved,
        ...[".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx"].map((ext) => resolved + ext),
      ];
      let found;
      for (const candidate of candidates) {
        try {
          if ((await fs.stat(safePath(root, candidate))).isFile()) {
            found = candidate;
            break;
          }
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
      }
      const dependency = found || resolved;
      if (!refs.has(dependency)) {
        refs.add(dependency);
        queue.push(dependency);
      }
    }
  }
  const snapshots = await fingerprintSources([...refs], { root });
  const pack = {
    schemaVersion: 1,
    target: cr || task || scenario,
    kind: cr ? "cr" : task ? "task" : "scenario",
    generatedAt: new Date().toISOString(),
    generatedView: true,
    allowedAction,
    authorizationRefs: authorization,
    scope,
    acceptanceCriteria: acceptance || [],
    questions: questions || [],
    prerequisites: selected.prerequisites || selected.preconditions || [],
    nextAction,
    materials,
    documentBaselineSelection,
    ...snapshots,
    excerpts: [],
    deferredReads: [],
    budgetBytes: budget,
  };
  for (const source of snapshots.coveredFiles) {
    if (source.missing) {
      pack.deferredReads.push({ path: source.path, reason: "文件缺失，需要补齐" });
      continue;
    }
    if (refs.has(source.path) && /\.(?:m?js|jsx|ts|tsx|css)$/.test(source.path)) {
      const content = await fs.readFile(safePath(root, source.path), "utf8");
      const lines = content.split("\n");
      const excerpt = {
        path: source.path,
        start: 1,
        end: Math.min(lines.length, 40),
        content: lines.slice(0, 40).join("\n"),
      };
      if (
        Buffer.byteLength(JSON.stringify({ ...pack, excerpts: [...pack.excerpts, excerpt] })) <=
        budget
      )
        pack.excerpts.push(excerpt);
      else pack.deferredReads.push({ path: source.path, reason: "超过软预算，按符号定位后读取" });
    }
  }
  pack.budgetExceeded = Buffer.byteLength(JSON.stringify(pack)) > budget;
  pack.integrity = hash(JSON.stringify(pack));
  return pack;
}
export async function verifyTaskContext(pack, { root }) {
  const { integrity, ...unsigned } = pack;
  if (integrity !== hash(JSON.stringify(unsigned)))
    return { status: "stale", reason: "上下文包被修改，请重新生成" };
  if (pack.documentBaselineSelection) {
    const selection = pack.documentBaselineSelection;
    let baseline;
    try {
      baseline = JSON.parse(await fs.readFile(safePath(root, selection.path), "utf8"));
    } catch (error) {
      return {
        status: error.code === "ENOENT" ? "missing" : "stale",
        reason: `文档基线无法复核：${error.message}`,
      };
    }
    const entries = selectDocumentBaselineEntries(baseline, selection.references);
    if (fingerprintDocumentBaselineEntries(entries) !== selection.selectionFingerprint) {
      return { status: "stale", reason: "当前任务采用的文档基线条目已变化，请重新生成" };
    }
  }
  return evaluateFreshness(pack, { root });
}
export function renderTaskContext(pack) {
  return `# ${pack.target} 当前任务\n\n> 自动生成，仅作索引；不构成实施授权。恢复工作前重新核对来源。\n\n允许动作：${pack.allowedAction}\n\n目标：${pack.scope?.objective || "待确认"}\n\n范围与验收：\n\n\u0060\u0060\u0060json\n${JSON.stringify({ scope: pack.scope, acceptance: pack.acceptanceCriteria, authorization: pack.authorizationRefs, questions: pack.questions, prerequisites: pack.prerequisites }, null, 2)}\n\u0060\u0060\u0060\n\n下一步：${pack.nextAction}\n\n来源：\n${pack.coveredFiles.map((f) => `- ${f.path}：${f.missing ? "缺失" : f.sha256}`).join("\n")}\n\n材料：\n${pack.materials.map((m) => `- ${m.id} ${m.locator} ${m.section || ""}`).join("\n")}\n\n采用文档：\n${(pack.documentBaselineSelection?.entries || []).map((entry) => `- ${entry.id} ${entry.type} ${entry.revisionLabel}（${entry.sections.join("、")}）`).join("\n")}\n\n预算：${pack.budgetExceeded ? "核心信息超过软预算，未截断" : "预算内"}；待展开 ${pack.deferredReads.length} 项。\n`;
}
export async function contextCommand(root, args) {
  const opts = parseOptions(args, { values: ["cr", "task", "scenario", "output", "verify"] });
  if (opts.verify) {
    const pack = JSON.parse(await fs.readFile(safePath(root, opts.verify), "utf8"));
    const result = await verifyTaskContext(pack, { root });
    console.log(JSON.stringify(result));
    if (result.status !== "fresh") process.exitCode = 1;
    return;
  }
  const pack = await createTaskContext({ root, ...opts });
  if (opts.output) {
    const target = safePath(root, opts.output);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(pack, null, 2) + "\n");
    await fs.writeFile(safePath(root, opts.output + ".md"), renderTaskContext(pack));
  } else console.log(JSON.stringify(pack, null, 2));
}
