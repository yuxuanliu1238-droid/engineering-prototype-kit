import { parseOptions } from "./cli-lib.mjs";
import { applyTransaction, restoreTransaction, snapshotFiles } from "./transaction-lib.mjs";
import { safePath } from "./safe-path.mjs";
import { runtimeEntries } from "./runtime-manifest.mjs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { KIT_VERSION, packageNameFor } from "./project-generator-lib.mjs";
import { ROOT } from "./project-lib.mjs";
import {
  makeActivities,
  makeEmptyRegistry,
  renderRequirements,
  validateRegistryData,
} from "./workflow-v3-lib.mjs";

const run = promisify(execFile);

const STAGE_MAP = {
  registered: "recorded",
  "waiting-start": "recorded",
  "impact-analysis": "analysis-confirmation",
  "rule-confirmation": "analysis-confirmation",
  "decision-record": "analysis-confirmation",
  "page-contract": "analysis-confirmation",
  "interactive-prototype": "implementation",
  "page-spec": "implementation",
  "consistency-check": "implementation",
  "user-review": "awaiting-review",
  synced: "completed",
};

function parseArgs(argv) {
  const result = parseOptions(argv, {
    values: ["project", "mode", "confirmed-by", "risk-map", "review-map", "rollback"],
    flags: ["apply"],
  });
  return { apply: false, ...result };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function safeProjectPath(root, relative) {
  return safePath(root, relative);
}

function legacyEvidence(item) {
  return (item.evidence || []).map((value, index) => ({
    id: `${item.id}-LEGACY-${String(index + 1).padStart(3, "0")}`,
    sourceType: "legacy-reference",
    location: value,
    originalClaim: value,
    aiInterpretation: "V0.2 字符串证据的兼容包装，未改变原文含义",
    scope: item.id,
    occurredAt: null,
    confirmationStatus: "legacy",
    confirmedBy: null,
    confirmedAt: null,
  }));
}

function activitySourceId(id) {
  return (
    {
      "scope-confirmation": "impact-analysis",
      implementation: "interactive-prototype",
      "page-check": "consistency-check",
      "product-review": "user-review",
    }[id] || id
  );
}

function migrateItem(item, risk, review) {
  const currentStageId = STAGE_MAP[item.currentStageId];
  const evidence = legacyEvidence(item);
  const riskAssessment =
    currentStageId === "recorded" && !risk
      ? null
      : {
          recommendedLevel: risk.recommendedLevel || risk.confirmedLevel,
          confirmedLevel: risk.confirmedLevel,
          triggers: risk.triggers || [],
          rationale: risk.rationale,
          proposedBy: "ai",
          confirmedBy: risk.confirmedBy,
          confirmedAt: risk.confirmedAt,
          downgradeReason: risk.downgradeReason ?? null,
          compensationMeasures: risk.compensationMeasures || [],
        };
  const oldNodes = new Map((item.nodes || []).map((node) => [node.stageId, node]));
  const activities = makeActivities(riskAssessment).map((activity) => {
    const old = oldNodes.get(activitySourceId(activity.id));
    const override = risk?.activityOverrides?.[activity.id];
    if (override) {
      return {
        ...activity,
        status: override.status,
        evidence: override.evidence || [],
        result: override.result ?? null,
        ...(override.status === "已跳过"
          ? { skipReason: override.result, skipConfirmationRef: override.evidence?.[0] }
          : {}),
      };
    }
    if (currentStageId === "completed" && activity.id === "product-review" && review) {
      return {
        ...activity,
        status: "已完成",
        evidence: ["migration:review-confirmation-map"],
        result: "依据产品经理提供的历史评审映射确认",
      };
    }
    return {
      ...activity,
      status: old?.status || "未开始",
      evidence: old?.evidence?.length
        ? old.evidence
        : old?.status === "已完成"
          ? ["migration:legacy-node-completed"]
          : [],
      result: old?.result || null,
    };
  });

  const activatesImpactIds = ["implementation", "awaiting-review", "completed"].includes(
    currentStageId,
  );
  const migrated = {
    id: item.id,
    summary: item.summary,
    originalRequest: item.originalRequest,
    source: item.source,
    proposedAt: item.proposedAt,
    currentStageId,
    executionState: item.executionState,
    aiPolicy: item.aiPolicy,
    executionScope: {
      objective: item.summary,
      included: [`迁移保留的原始请求：${item.originalRequest}`],
      excluded: [],
      deferred: ["V0.3 首次触达时复核实施范围"],
    },
    riskAssessment,
    activities,
    readinessChecklist: item.readinessChecklist,
    waitingReason: item.waitingReason,
    pauseReason: null,
    cancellationReason: item.cancellationReason || null,
    evidence,
    artifacts: item.artifacts || [],
    reviewConfirmation: null,
    pageIds: activatesImpactIds ? item.pageIds || [] : [],
    actionIds: activatesImpactIds ? item.actionIds || [] : [],
    stateIds: activatesImpactIds ? item.stateIds || [] : [],
    documents: item.documents || [],
    remainingRisks: ["迁移记录尚未完成 V0.3 语义复核"],
    openQuestions: [
      "首次触达本需求时复核风险、范围与历史证据",
      ...(!activatesImpactIds &&
      [...(item.pageIds || []), ...(item.actionIds || []), ...(item.stateIds || [])].length
        ? ["V0.2 已记录的影响 ID 保留在迁移证据中，进入实施阶段后再确认激活"]
        : []),
    ],
  };
  if (currentStageId === "completed") {
    migrated.reviewConfirmation = {
      outcome: review.outcome,
      continueBuild: review.continueBuild,
      confirmedScope: review.confirmedScope || [],
      excludedScope: review.excludedScope || [],
      confirmedRules: review.confirmedRules || [],
      nonBlockingQuestions: review.nonBlockingQuestions || [],
      evidenceIds: evidence.map((entry) => entry.id),
      confirmedBy: review.confirmedBy,
      confirmedAt: review.confirmedAt || item.userConfirmationDate,
    };
  }
  return migrated;
}

async function rollbackLatest(projectRoot) {
  console.log(await restoreTransaction(projectRoot, "migration-v02-v03"));
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) throw new Error("缺少项目路径 --project");
const projectRoot = path.resolve(args.project);
if (args.rollback === "latest") {
  await rollbackLatest(projectRoot);
  process.exit(0);
}

const configPath = safePath(projectRoot, "project.config.json");
const config = await readJson(configPath);
const registryPath = safeProjectPath(
  projectRoot,
  config.paths?.requirements || "docs/requirements/registry.json",
);
const summaryPath = safeProjectPath(
  projectRoot,
  config.paths?.requirementsSummary || "docs/requirements/requirements.md",
);
const registry = await readJson(registryPath);
if (registry.schemaVersion !== 2) throw new Error("目标需求台账不是 Schema v2，未执行迁移");
const riskMap = args["risk-map"] ? await readJson(path.resolve(args["risk-map"])) : {};
const reviewMap = args["review-map"] ? await readJson(path.resolve(args["review-map"])) : {};
const questions = [];
let migrated = null;

if (args.mode !== "continuous-iteration") {
  questions.push("V0.2 正式 CR 台账迁移必须由产品经理确认 --mode continuous-iteration");
}
if (!args["confirmed-by"]?.trim()) {
  questions.push("缺少 V0.3 项目模式确认人 --confirmed-by");
}

for (const item of registry.items || []) {
  if (!STAGE_MAP[item.currentStageId])
    questions.push(`${item.id} 的旧阶段无法映射：${item.currentStageId}`);
  const mappedStage = STAGE_MAP[item.currentStageId];
  if (mappedStage !== "recorded" && !riskMap[item.id]) {
    questions.push(`${item.id} 缺少产品经理确认的 V0.3 风险等级`);
  }
  const activityOverrides = riskMap[item.id]?.activityOverrides;
  if (activityOverrides !== undefined) {
    if (
      !activityOverrides ||
      typeof activityOverrides !== "object" ||
      Array.isArray(activityOverrides)
    ) {
      questions.push(`${item.id} 的 activityOverrides 必须是按活动 ID 索引的对象`);
    } else {
      const expectedActivityIds = new Set(
        makeActivities({
          confirmedLevel: riskMap[item.id]?.confirmedLevel,
          triggers: riskMap[item.id]?.triggers || [],
        }).map((activity) => activity.id),
      );
      for (const [activityId, override] of Object.entries(activityOverrides)) {
        if (!expectedActivityIds.has(activityId)) {
          questions.push(`${item.id} 的活动映射包含当前风险清单之外的活动：${activityId}`);
          continue;
        }
        if (!override || typeof override !== "object" || Array.isArray(override)) {
          questions.push(`${item.id}.${activityId} 的活动映射必须是对象`);
          continue;
        }
        if (override.status === "已跳过" && !override.result?.trim()) {
          questions.push(`${item.id}.${activityId} 标记为已跳过时必须记录理由`);
        }
      }
    }
  }
  if (mappedStage === "completed") {
    if (!reviewMap[item.id]) questions.push(`${item.id} 缺少可追溯的产品评审确认映射`);
    const types = new Set((item.artifacts || []).map((artifact) => artifact.type));
    if (!types.has("user-confirmation"))
      questions.push(`${item.id} 缺少历史 user-confirmation 产物`);
    if (!["test-report", "review-report"].some((type) => types.has(type))) {
      questions.push(`${item.id} 缺少历史测试或评审报告产物`);
    }
  }
}

if (!questions.length) {
  try {
    migrated = makeEmptyRegistry();
    migrated.items = (registry.items || []).map((item) =>
      migrateItem(item, riskMap[item.id], reviewMap[item.id]),
    );
    const candidateErrors = validateRegistryData(migrated);
    questions.push(...candidateErrors.map((error) => `结构化迁移仍需确认：${error}`));
  } catch (error) {
    questions.push(`结构化迁移无法确定：${error.message}`);
  }
}

const migrationRuntimeSources = new Map([...runtimeEntries().map((e) => [e.target, e.source])]);
const migrationRuntimeContents = new Map();
let legacyPackage = null;
for (const [target, source] of migrationRuntimeSources) {
  const desired = await fs.readFile(path.join(ROOT, source));
  migrationRuntimeContents.set(target, desired);
  const absoluteTarget = safeProjectPath(projectRoot, target);
  if (await exists(absoluteTarget)) {
    const current = await fs.readFile(absoluteTarget);
    if (!current.equals(desired)) questions.push(`${target} 已存在且内容无法确定是否可覆盖`);
  }
}
if (await exists(safePath(projectRoot, ".prototype-kit/manifest.json"))) {
  questions.push("目标项目已存在 V0.3 管理清单，不能重复执行 V0.2 迁移");
}
try {
  legacyPackage = await readJson(safePath(projectRoot, "package.json"));
} catch {
  questions.push("目标 V0.2 项目缺少可读取的 package.json，无法安装最小业务运行命令");
}
for (const requiredPath of [
  "AGENTS.md",
  "README.md",
  "START-HERE.md",
  "inbox/README.md",
  "prototype/package.json",
  "prototype/src/App.jsx",
]) {
  if (!(await exists(safeProjectPath(projectRoot, requiredPath)))) {
    questions.push(`目标 V0.2 项目缺少运行所需路径：${requiredPath}`);
  }
}

const reportDirectory = safePath(projectRoot, "dist/migrations");
await fs.mkdir(reportDirectory, { recursive: true });
const reportPath = path.join(reportDirectory, "v0.2-to-v0.3-impact-report.md");
const report = [
  "# V0.2 → V0.3 迁移影响报告",
  "",
  `- 项目：${config.projectName || path.basename(projectRoot)}`,
  `- CR 数量：${(registry.items || []).length}`,
  "- 默认动作：只生成影响报告，不修改业务正文、原型行为和历史确认",
  "",
  "## 阶段映射",
  "",
  "- registered / waiting-start → recorded",
  "- impact-analysis / rule-confirmation / decision-record / page-contract → analysis-confirmation",
  "- interactive-prototype / page-spec / consistency-check → implementation",
  "- user-review → awaiting-review",
  "- synced → completed",
  "",
  "## 兼容处理",
  "",
  "- 原字符串证据包装为 legacy-reference，原文和位置不改写；",
  "- 原十一节点保存到迁移证据，V0.3 台账只保留五阶段和风险活动；",
  "- 初始化最小业务基线、持续迭代模式确认、隐藏运行时和固定 Kit 版本；",
  "- 旧 Skills、脚本、模板、示例、设计稿、发布历史和旧治理说明如已存在，只标记为未审计历史，不删除也不进入业务评审包；",
  "- V0.3 新增且无法从旧节点确定的高风险活动，必须通过 risk-map.activityOverrides 逐项确认完成或跳过；",
  "- 原业务正文、原型与历史确认文件不在写入范围。",
];
if (questions.length) {
  report.push(
    "",
    "## 唯一待确认问题",
    "",
    `请一次性补齐以下 ${questions.length} 个无法确定的映射后再授权应用：${questions.join("；")}。`,
  );
}
await fs.writeFile(
  safePath(projectRoot, path.relative(projectRoot, reportPath)),
  `${report.join("\n")}\n`,
  "utf8",
);
console.log(`已生成迁移影响报告：${reportPath}`);

if (!args.apply) {
  console.log("当前为预览；只有增加 --apply 才会写入迁移结果。");
  process.exit(questions.length ? 1 : 0);
}
if (questions.length) throw new Error(`迁移被阻断：${questions[0]}`);

const validationErrors = validateRegistryData(migrated);
if (validationErrors.length) throw new Error(`迁移临时副本校验失败：${validationErrors[0]}`);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "epk-v03-migration-"));
const tempRegistry = path.join(tempRoot, "registry.json");
const tempSummary = path.join(tempRoot, "requirements.md");
await fs.writeFile(tempRegistry, `${JSON.stringify(migrated, null, 2)}\n`, "utf8");
await fs.writeFile(tempSummary, renderRequirements(migrated), "utf8");
if ((await readJson(tempRegistry)).schemaVersion !== 3) throw new Error("临时副本回读失败");

const timestamp = new Date().toISOString();
const timestampSlug = timestamp.replaceAll(":", "-");
const backupRoot = path.join(
  projectRoot,
  ".prototype-kit",
  "backups",
  `migration-v02-v03-${timestamp.replaceAll(":", "-")}`,
);
const evidenceRelativePath = `.prototype-kit/migrations/${timestampSlug}.json`;
const internalCandidates = [
  "skills",
  "scripts",
  "examples",
  "templates",
  "docs/design",
  "docs/review/v0.1-verification.md",
  "docs/review/v0.2-verification.md",
  "docs/review/review-baseline.md",
  "docs/review/review-checklist.md",
  "docs/review/change-request-flow.md",
  "docs/review/work-package-evidence.md",
  "docs/requirements/task-control-model.md",
];
const retainedInternalPaths = [];
for (const relativePath of internalCandidates) {
  if (await exists(safeProjectPath(projectRoot, relativePath)))
    retainedInternalPaths.push(relativePath);
}

const oldStatus = (await exists(safePath(projectRoot, "project-status.json")))
  ? await readJson(safePath(projectRoot, "project-status.json"))
  : null;
const upgradedConfig = {
  ...config,
  schemaVersion: 2,
  instanceKind: "business-project",
  kitVersion: KIT_VERSION,
  projectName: config.projectName || path.basename(projectRoot),
  packageName:
    config.packageName || packageNameFor(config.projectName || path.basename(projectRoot)),
  paths: {
    ...(config.paths || {}),
    requirements: path.relative(projectRoot, registryPath).split(path.sep).join("/"),
    requirementsSummary: path.relative(projectRoot, summaryPath).split(path.sep).join("/"),
    contracts: config.paths?.contracts || "prototype/src/contracts/contracts.json",
    pageGuides: config.paths?.pageGuides || "docs/page-guides/pages.md",
    demoBlueprint: config.paths?.demoBlueprint || "docs/demo-blueprint.md",
    reviewScenarios: config.paths?.reviewScenarios || "prototype/src/review-scenarios.json",
    releaseOutput: config.paths?.releaseOutput || "dist/review",
  },
  validation: {
    allowedSurfaces: config.validation?.allowedSurfaces || ["mobile", "admin", "web", "service"],
    implementationStatuses: config.validation?.implementationStatuses || [
      "implemented",
      "partial",
      "planned",
    ],
  },
  legacyMigration: {
    fromKitVersion: config.kitVersion || "0.2.x",
    migratedAt: timestamp,
    retainedInternalPaths,
  },
};
const upgradedStatus = {
  schemaVersion: 2,
  currentMode: "continuous-iteration",
  modeState: "confirmed",
  modeHistory: [
    {
      mode: "continuous-iteration",
      recommendedBy: "ai",
      recommendationReason: "V0.2 项目已有正式 CR 台账，产品经理确认按持续迭代模式迁移",
      confirmedBy: args["confirmed-by"].trim(),
      confirmedAt: timestamp,
      evidence: "V0.2 → V0.3 迁移明确授权",
    },
  ],
  validationProfile: {
    focuses: ["business-solution"],
    primaryFocus: "business-solution",
    recommendedBy: "ai",
    recommendationReason: "旧项目已有正式需求台账，本次迁移只验证持续迭代治理结构",
    confirmationState: "confirmed",
    confirmedBy: args["confirmed-by"].trim(),
    confirmedAt: timestamp,
    inputSufficiency: {
      level: "sufficient",
      reason: "迁移只处理已有台账和治理结构，不补写业务事实",
      known: ["已有正式需求台账"],
      missing: [],
      canProceed: ["Schema v3 迁移"],
      requiresConfirmation: [],
      mustNotDo: ["改写业务正文、原型行为和历史确认"],
    },
    reviewCenter: { enabled: false, reason: "迁移不新增评审中心或业务原型入口" },
  },
  activeChangeRequest: oldStatus?.activeChangeRequest || null,
  nextGate: "change-request-authorization",
  updatedAt: timestamp,
};
const legacyScripts = { ...(legacyPackage.scripts || {}) };
for (const commandName of [
  "check",
  "workflow:generate",
  "page-guides:generate",
  "package:review",
]) {
  if (legacyScripts[commandName] && !legacyScripts[`legacy:${commandName}`]) {
    legacyScripts[`legacy:${commandName}`] = legacyScripts[commandName];
  }
}
const upgradedPackage = {
  ...legacyPackage,
  private: true,
  type: legacyPackage.type || "module",
  packageManager: legacyPackage.packageManager || "pnpm@10.12.4",
  scripts: {
    ...legacyScripts,
    check: "node .prototype-kit/business-cli.mjs check",
    "workflow:generate": "node .prototype-kit/business-cli.mjs generate",
    "page-guides:generate": "node .prototype-kit/business-cli.mjs generate-page-guides",
    "package:review":
      "pnpm --dir prototype build && node .prototype-kit/business-cli.mjs package-review",
  },
  dependencies: {
    ...(legacyPackage.dependencies || {}),
    fflate: legacyPackage.dependencies?.fflate || "0.8.2",
  },
};

const templateRoot = path.join(ROOT, "templates/business-project");
const baselineTemplate = (
  await fs.readFile(path.join(templateRoot, "shared/docs/business-baseline.md"), "utf8")
)
  .replace("当前形态：业务验证简报", "当前形态：持续迭代最小基线")
  .replace("当前模式：待产品经理确认", "当前模式：continuous-iteration")
  .concat(
    "\n## 10. V0.2 兼容说明\n\n现有业务正文保持原位置，当前只建立最小入口。未被新需求触达的历史模块保持“未审计”，不得据此宣称已完成全项目治理。\n",
  );
const reviewTemplate = await fs.readFile(
  path.join(templateRoot, "shared/docs/review/review-confirmation.md"),
);
const requirementsReadme = await fs.readFile(
  path.join(templateRoot, "continuous/docs/requirements/README.md"),
);
const pageGuidesReadme = await fs.readFile(
  path.join(templateRoot, "continuous/docs/page-guides/README.md"),
);
const decisionsCompatibility = Buffer.from(
  "# 决策台账\n\n> V0.2 兼容入口：历史正向、负向决策保持原文件，不自动合并或改写。新需求首次触达相关规则时，由产品经理确认后再转入本台账。\n\n## 未审计历史入口\n\n- `positive.md`：如存在，仅作为历史来源；\n- `negative.md`：如存在，仅作为历史来源。\n",
);

const materialDefaults = new Map([
  ["docs/business-baseline.md", Buffer.from(baselineTemplate)],
  ["docs/review/review-confirmation.md", reviewTemplate],
  ["docs/decisions/decisions.md", decisionsCompatibility],
  ["docs/requirements/README.md", requirementsReadme],
  ["docs/page-guides/README.md", pageGuidesReadme],
]);
const plannedWrites = new Map([
  [
    path.relative(projectRoot, registryPath).split(path.sep).join("/"),
    await fs.readFile(tempRegistry),
  ],
  [
    path.relative(projectRoot, summaryPath).split(path.sep).join("/"),
    await fs.readFile(tempSummary),
  ],
  ["project.config.json", Buffer.from(`${JSON.stringify(upgradedConfig, null, 2)}\n`)],
  ["project-status.json", Buffer.from(`${JSON.stringify(upgradedStatus, null, 2)}\n`)],
  ["package.json", Buffer.from(`${JSON.stringify(upgradedPackage, null, 2)}\n`)],
]);
for (const [relativePath, content] of migrationRuntimeContents)
  plannedWrites.set(relativePath, content);
for (const [relativePath, content] of materialDefaults) {
  if (!(await exists(safeProjectPath(projectRoot, relativePath))))
    plannedWrites.set(relativePath, content);
}

const migrationEvidence = {
  from: 2,
  to: 3,
  appliedAt: timestamp,
  confirmedMode: "continuous-iteration",
  confirmedBy: args["confirmed-by"].trim(),
  stageMap: STAGE_MAP,
  backup: path.relative(projectRoot, backupRoot),
  originalRegistrySha256: createHash("sha256")
    .update(await fs.readFile(registryPath))
    .digest("hex"),
  originalItems: registry.items || [],
  originalProjectStatus: oldStatus,
  retainedInternalPaths,
};
plannedWrites.set(
  evidenceRelativePath,
  Buffer.from(`${JSON.stringify(migrationEvidence, null, 2)}\n`),
);

const requirementsRelativePath = path.relative(projectRoot, registryPath).split(path.sep).join("/");
const summaryRelativePath = path.relative(projectRoot, summaryPath).split(path.sep).join("/");
const ownershipFor = (relativePath) => {
  if (migrationRuntimeContents.has(relativePath) || relativePath === "project.config.json")
    return "kit-managed";
  if (relativePath === summaryRelativePath) return "generated-view";
  return "business";
};
const manifestFiles = [];
for (const relativePath of [
  ...migrationRuntimeContents.keys(),
  "project.config.json",
  "project-status.json",
  "package.json",
  "docs/business-baseline.md",
  "docs/review/review-confirmation.md",
  "docs/decisions/decisions.md",
  "docs/requirements/README.md",
  "docs/page-guides/README.md",
  requirementsRelativePath,
  summaryRelativePath,
]) {
  const content =
    plannedWrites.get(relativePath) ||
    (await fs.readFile(safeProjectPath(projectRoot, relativePath)));
  manifestFiles.push({
    path: relativePath,
    ownership: ownershipFor(relativePath),
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}
const projectManifest = {
  schemaVersion: 1,
  kitVersion: KIT_VERSION,
  createdAt: timestamp,
  migratedFrom: config.kitVersion || "0.2.x",
  legacyCompatibility: true,
  files: manifestFiles.sort((left, right) => left.path.localeCompare(right.path)),
};
plannedWrites.set(
  ".prototype-kit/manifest.json",
  Buffer.from(`${JSON.stringify(projectManifest, null, 2)}\n`),
);

const expectedWrites = await snapshotFiles(projectRoot, [...plannedWrites.keys()]);
const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), "epk-v03-project-validation-"));
const stagingPaths = new Set([
  ...plannedWrites.keys(),
  "AGENTS.md",
  "README.md",
  "START-HERE.md",
  "inbox/README.md",
  "prototype/package.json",
  "prototype/src/App.jsx",
]);
for (const relativePath of stagingPaths) {
  const content =
    plannedWrites.get(relativePath) ||
    (await fs.readFile(safeProjectPath(projectRoot, relativePath)));
  const target = path.join(stagingRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}
try {
  await run(process.execPath, [".prototype-kit/business-cli.mjs", "check"], {
    cwd: stagingRoot,
    maxBuffer: 4 * 1024 * 1024,
  });
} catch (error) {
  throw new Error(`迁移临时业务项目校验失败：${error.stderr || error.stdout || error.message}`);
}

const transactionBackup = await applyTransaction(projectRoot, "migration-v02-v03", plannedWrites, {
  expected: expectedWrites,
});
await fs.rm(stagingRoot, { recursive: true, force: true });
console.log(`迁移已应用；备份位于 ${transactionBackup}`);
