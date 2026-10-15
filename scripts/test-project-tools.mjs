import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { unzipSync } from "fflate";
import { createBusinessProject, KIT_VERSION } from "./project-generator-lib.mjs";
import { makeActivities, makeEmptyRegistry, makeReadiness } from "./workflow-v3-lib.mjs";
import { ROOT } from "./project-lib.mjs";

const run = promisify(execFile);
const errors = [];

function expect(condition, message) {
  if (!condition) errors.push(message);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function sha(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function linkDependencies(projectRoot) {
  await fs.symlink(path.join(ROOT, "node_modules"), path.join(projectRoot, "node_modules"), "dir");
  await fs.symlink(
    path.join(ROOT, "prototype", "node_modules"),
    path.join(projectRoot, "prototype", "node_modules"),
    "dir",
  );
}

async function runNode(script, args, cwd = ROOT) {
  return run(process.execPath, [script, ...args], { cwd, maxBuffer: 4 * 1024 * 1024 });
}

async function expectReject(action, message) {
  try {
    await action();
    errors.push(message);
  } catch {
    // 预期由门禁阻断。
  }
}

const rapidValidation = {
  validationFocuses: ["generation-workflow", "prototype-presentation"],
  primaryValidationFocus: "generation-workflow",
  validationRecommendationReason: "有限材料适合验证生成工作流和 B 端原型呈现",
  inputSufficiency: "partial",
  inputSufficiencyReason: "可生成核心流程，但业务规则仍需产品确认",
  inputKnown: ["验证目标", "核心流程方向"],
  inputMissing: ["完整业务规则"],
  inputCanProceed: ["Demo 蓝图", "可运行原型"],
  inputRequiresConfirmation: ["菜单范围", "必要配置和代表性异常"],
  inputMustNotDo: ["把 AI 候选自动升级为正式业务结论"],
  reviewCenterEnabled: true,
  reviewCenterReason: "需要独立入口组织多个评审场景",
};

await expectReject(
  () =>
    createBusinessProject({
      ...rapidValidation,
      name: "输入不充分测试",
      output: path.join(sandbox, "insufficient-input"),
      mode: "rapid-validation",
      recommendationReason: "先判断是否具备生成条件",
      confirmedBy: "测试产品经理",
      inputSufficiency: "insufficient",
    }),
  "输入不充分时不应创建 Demo 项目",
);

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "epk-v03-tools-"));
await expectReject(
  () =>
    createBusinessProject({
      name: "缺少推荐依据",
      output: path.join(sandbox, "unassessed-mode"),
      mode: "rapid-validation",
      confirmedBy: "测试产品经理",
    }),
  "缺少 AI 推荐依据时不应创建业务项目",
);
const rapidRoot = path.join(sandbox, "rapid-random-name");
await createBusinessProject({
  ...rapidValidation,
  name: "快速验证测试",
  output: rapidRoot,
  mode: "rapid-validation",
  recommendationReason: "客户现场需要先验证核心流程",
  confirmedBy: "测试产品经理",
  confirmedAt: "2026-09-01T00:00:00.000Z",
});
expect(await exists(path.join(rapidRoot, "docs/business-baseline.md")), "快速实例缺少业务基线");
expect(
  !(await exists(path.join(rapidRoot, "docs/requirements/registry.json"))),
  "快速实例不应创建正式 CR",
);
expect(!(await exists(path.join(rapidRoot, "skills"))), "业务实例不应复制 Skills");
expect(!(await exists(path.join(rapidRoot, "examples"))), "业务实例不应复制示例");
expect(!(await exists(path.join(rapidRoot, "docs/design"))), "业务实例不应复制 Kit 设计文档");
expect(await exists(path.join(rapidRoot, "docs/demo-blueprint.md")), "部分充分输入缺少 Demo 蓝图");
expect(
  (await readJson(path.join(rapidRoot, "project-status.json"))).validationProfile.primaryFocus ===
    "generation-workflow",
  "评审目标未保存为单一状态",
);
expect(
  (await readJson(path.join(rapidRoot, "prototype/src/review-scenarios.json")))
    .reviewCenterEnabled === true,
  "评审中心配置未按确认结果生成",
);
await linkDependencies(rapidRoot);
await runNode(".prototype-kit/business-cli.mjs", ["check"], rapidRoot);
await run("pnpm", ["--dir", path.join(rapidRoot, "prototype"), "build"], {
  maxBuffer: 4 * 1024 * 1024,
});
await runNode(".prototype-kit/business-cli.mjs", ["package-review"], rapidRoot);
const reviewArchive = await fs.readFile(
  path.join(rapidRoot, "dist/review/business-prototype-review.zip"),
);
const reviewEntries = Object.keys(unzipSync(reviewArchive));
expect(
  reviewEntries.some((entry) => entry.endsWith("/prototype/dist/index.html")),
  "业务评审包缺少生产构建",
);
expect(
  !reviewEntries.some(
    (entry) =>
      entry.includes("/skills/") || entry.includes("/inbox/") || entry.includes("/.prototype-kit/"),
  ),
  "业务评审包混入 Kit 内部材料、运行时或输入区",
);

const simpleRapidRoot = path.join(sandbox, "rapid-sufficient-simple");
await createBusinessProject({
  ...rapidValidation,
  name: "充分输入单场景测试",
  output: simpleRapidRoot,
  mode: "rapid-validation",
  recommendationReason: "材料充分且只有一个简单场景",
  confirmedBy: "测试产品经理",
  inputSufficiency: "sufficient",
  inputSufficiencyReason: "验证目标、流程和范围均已明确",
  reviewCenterEnabled: false,
  reviewCenterReason: "单场景可直接进入业务系统",
});
expect(
  !(await exists(path.join(simpleRapidRoot, "docs/demo-blueprint.md"))),
  "充分且简单的快速项目不应被强制创建 Demo 蓝图",
);
expect(
  (await readJson(path.join(simpleRapidRoot, "prototype/src/review-scenarios.json")))
    .reviewCenterEnabled === false,
  "简单场景不应启用评审中心",
);
await linkDependencies(simpleRapidRoot);
await runNode(".prototype-kit/business-cli.mjs", ["check"], simpleRapidRoot);

const continuousRoot = path.join(sandbox, "continuous-another-name");
await createBusinessProject({
  name: "持续迭代测试",
  output: continuousRoot,
  mode: "continuous-iteration",
  recommendationReason: "项目已进入持续功能迭代",
  confirmedBy: "测试产品经理",
  confirmedAt: "2026-09-01T00:00:00.000Z",
});
expect(
  (await readJson(path.join(continuousRoot, "docs/requirements/registry.json"))).schemaVersion ===
    3,
  "持续实例未初始化 Schema v3",
);
await linkDependencies(continuousRoot);
await runNode(".prototype-kit/business-cli.mjs", ["check"], continuousRoot);
await fs.appendFile(
  path.join(continuousRoot, "docs/requirements/requirements.md"),
  "\n手工修改。\n",
);
await expectReject(
  () => runNode(".prototype-kit/business-cli.mjs", ["check"], continuousRoot),
  "需求可读视图与台账不同步时不应通过业务项目检查",
);
await runNode(".prototype-kit/business-cli.mjs", ["generate"], continuousRoot);
await runNode(".prototype-kit/business-cli.mjs", ["check"], continuousRoot);

const standardRisk = {
  recommendedLevel: "standard",
  confirmedLevel: "standard",
  triggers: [],
  rationale: "触达一个普通页面",
  proposedBy: "ai",
  confirmedBy: "测试产品经理",
  confirmedAt: "2026-09-01",
  downgradeReason: null,
  compensationMeasures: [],
};
const pageCr = {
  id: "CR-001",
  summary: "新增触达页面",
  originalRequest: "新增一个可验证页面",
  source: "测试",
  proposedAt: "2026-09-01",
  currentStageId: "implementation",
  executionState: "locked",
  aiPolicy: "unassessed",
  executionScope: {
    objective: "验证页面契约生成",
    included: ["测试页面"],
    excluded: [],
    deferred: [],
  },
  riskAssessment: standardRisk,
  activities: makeActivities(standardRisk),
  readinessChecklist: makeReadiness(),
  waitingReason: null,
  pauseReason: null,
  cancellationReason: null,
  evidence: [],
  artifacts: [],
  reviewConfirmation: null,
  pageIds: ["test.page"],
  actionIds: ["test.submit"],
  stateIds: ["test.ready"],
  documents: [],
  remainingRisks: [],
  openQuestions: [],
};
// This fixture exercises legacy page-contract generation, not the new authorization lifecycle.
const pageRegistry = makeEmptyRegistry({legacyStages:true});
pageRegistry.items = [pageCr];
await fs.writeFile(
  path.join(continuousRoot, "docs/requirements/registry.json"),
  `${JSON.stringify(pageRegistry, null, 2)}\n`,
);
await runNode(".prototype-kit/business-cli.mjs", ["generate"], continuousRoot);
const pageContracts = [
  {
    schemaVersion: 1,
    sourceCrId: "CR-001",
    pageId: "test.page",
    surface: "web",
    title: "测试页面",
    goal: "验证契约到页面说明的生成关系",
    implementationStatus: "planned",
    preview: { entry: "index.html", defaultStateId: "test.ready" },
    sections: [
      { id: "test.main", title: "主体", description: "测试区域", implementationStatus: "planned" },
    ],
    actions: [
      {
        id: "test.submit",
        label: "提交",
        trigger: "点击提交按钮",
        preconditions: [],
        validations: [],
        successResult: "显示成功结果",
        nextPageId: null,
        dataEffects: [],
        failureHandling: "显示失败提示并允许重试",
        implementationStatus: "planned",
      },
    ],
    states: [
      {
        id: "test.ready",
        label: "可操作",
        enterWhen: "页面加载完成",
        visibleChanges: "显示提交按钮",
        allowedActionIds: ["test.submit"],
        recovery: "刷新页面重新开始",
        implementationStatus: "planned",
      },
    ],
    rules: [],
    dataFields: [],
    integrations: [],
    exceptions: [],
    acceptanceCriteria: [
      {
        id: "test.ac.001",
        given: "页面已加载",
        when: "用户点击提交",
        then: "用户看到成功结果",
        implementationStatus: "planned",
      },
    ],
  },
];
await fs.mkdir(path.join(continuousRoot, "prototype/src/contracts"), { recursive: true });
await fs.writeFile(
  path.join(continuousRoot, "prototype/src/contracts/contracts.json"),
  `${JSON.stringify(pageContracts, null, 2)}\n`,
);
await runNode(".prototype-kit/business-cli.mjs", ["generate-page-guides"], continuousRoot);
await runNode(".prototype-kit/business-cli.mjs", ["check"], continuousRoot);
expect(
  await exists(path.join(continuousRoot, "docs/page-guides/pages.md")),
  "页面契约存在时没有生成页面说明",
);

const highRisk = {
  ...standardRisk,
  recommendedLevel: "high",
  confirmedLevel: "high",
  triggers: ["permissions"],
};
pageRegistry.items[0].riskAssessment = highRisk;
pageRegistry.items[0].activities = makeActivities(highRisk);
await fs.writeFile(
  path.join(continuousRoot, "docs/requirements/registry.json"),
  `${JSON.stringify(pageRegistry, null, 2)}\n`,
);
await expectReject(
  () => runNode(".prototype-kit/business-cli.mjs", ["generate-page-guides"], continuousRoot),
  "权限高风险页面缺少专项契约字段时不应生成页面说明",
);

const switchRoot = path.join(sandbox, "switch-target");
await createBusinessProject({
  ...rapidValidation,
  name: "模式切换测试",
  output: switchRoot,
  mode: "rapid-validation",
  recommendationReason: "先用有限材料验证 Demo",
  confirmedBy: "测试产品经理",
  confirmedAt: "2026-09-01T00:00:00.000Z",
});
const switchScript = path.join(ROOT, "scripts/switch-project-mode.mjs");
const switchArgs = [
  "--project",
  switchRoot,
  "--outcome",
  "approved",
  "--continue-build",
  "--confirmed-by",
  "测试产品经理",
  "--evidence",
  "docs/review/review-confirmation.md",
];
await expectReject(
  () => runNode(switchScript, [...switchArgs, "--apply"]),
  "未填写的评审确认单不应允许模式切换",
);
expect(
  (await readJson(path.join(switchRoot, "project-status.json"))).currentMode === "rapid-validation",
  "无效评审证据改变了项目模式",
);
await fs.writeFile(
  path.join(switchRoot, "docs/review/review-confirmation.md"),
  "# 需求评审确认单\n\n- 当前状态：已评审\n- 评审结论：通过\n- 产品确认人：测试产品经理\n- 是否明确继续建设：是\n- 产品经理确认模式：continuous-iteration\n- 模式切换结论：生效\n",
);
await fs.writeFile(
  path.join(switchRoot, "docs/business-baseline.md"),
  "# 当前业务基线\n\n> 当前形态：业务验证简报\n>\n> 当前模式：rapid-validation\n>\n> 生效评审：暂无\n>\n> 最后确认：暂无\n\n## 6. 临时假设\n\n| 编号 | 假设 | 为何暂用 | 影响 | 最晚确认节点 | 状态 |\n|---|---|---|---|---|---|\n| ASM-001 | 演示数据可代表流程 | 支持评审 | 不用于生产 | 需求评审 | 仍待确认 |\n\n## 8. Demo 与评审\n\n- 需求评审结论：通过\n\n## 9. 持续迭代基线\n\n- 正式范围：测试范围。\n",
);
await runNode(switchScript, switchArgs);
expect(
  (await readJson(path.join(switchRoot, "project-status.json"))).currentMode === "rapid-validation",
  "模式预览不应自动切换",
);
await runNode(switchScript, [...switchArgs, "--apply"]);
expect(
  (await readJson(path.join(switchRoot, "project-status.json"))).currentMode ===
    "continuous-iteration",
  "明确应用后未切换模式",
);
expect(
  (await fs.readFile(path.join(switchRoot, "docs/business-baseline.md"), "utf8")).includes(
    "当前模式：continuous-iteration",
  ),
  "模式切换未升级同一份业务基线",
);
expect(
  await exists(path.join(switchRoot, "docs/requirements/registry.json")),
  "切换后未初始化 CR 结构",
);

const migrationRoot = path.join(sandbox, "legacy-project-not-fixed-clone-name");
await fs.mkdir(path.join(migrationRoot, "docs/requirements"), { recursive: true });
for (const relativePath of [
  "skills/legacy.txt",
  "examples/legacy.txt",
  "docs/design/legacy.md",
  "inbox/README.md",
  "prototype/src/App.jsx",
]) {
  const target = path.join(migrationRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "V0.2 历史内容，不得丢失。\n");
}
await fs.writeFile(path.join(migrationRoot, "AGENTS.md"), "# V0.2 规则\n");
await fs.writeFile(path.join(migrationRoot, "README.md"), "# V0.2 项目\n");
await fs.writeFile(path.join(migrationRoot, "START-HERE.md"), "# V0.2 入口\n");
await fs.writeFile(
  path.join(migrationRoot, "package.json"),
  '{"name":"legacy-project","private":true,"type":"module","scripts":{"check":"node legacy-check.mjs"}}\n',
);
await fs.mkdir(path.join(migrationRoot, "prototype"), { recursive: true });
await fs.writeFile(
  path.join(migrationRoot, "prototype/package.json"),
  '{"name":"legacy-prototype","private":true,"type":"module"}\n',
);
const legacyRegistry = {
  schemaVersion: 2,
  stageDefinitions: [],
  nodeStatuses: [],
  taskControlDefinitions: {},
  items: [],
};
await fs.writeFile(
  path.join(migrationRoot, "docs/requirements/registry.json"),
  `${JSON.stringify(legacyRegistry, null, 2)}\n`,
);
await fs.writeFile(
  path.join(migrationRoot, "docs/requirements/requirements.md"),
  "# 原 V0.2 需求视图\n",
);
await fs.writeFile(
  path.join(migrationRoot, "project-status.json"),
  `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`,
);
await fs.writeFile(
  path.join(migrationRoot, "project.config.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      kitVersion: "0.2.0",
      projectName: "旧项目迁移测试",
      paths: {
        requirements: "docs/requirements/registry.json",
        requirementsSummary: "docs/requirements/requirements.md",
      },
    },
    null,
    2,
  )}\n`,
);
const legacyChecksum = sha(
  await fs.readFile(path.join(migrationRoot, "docs/requirements/registry.json")),
);
const legacyPrototypeChecksum = sha(
  await fs.readFile(path.join(migrationRoot, "prototype/src/App.jsx")),
);
const migrationScript = path.join(ROOT, "scripts/migrate-v02-to-v03.mjs");
const migrationModeArgs = ["--mode", "continuous-iteration", "--confirmed-by", "测试产品经理"];
await runNode(migrationScript, ["--project", migrationRoot, ...migrationModeArgs]);
expect(
  (await readJson(path.join(migrationRoot, "docs/requirements/registry.json"))).schemaVersion === 2,
  "迁移预览修改了旧台账",
);
await runNode(migrationScript, ["--project", migrationRoot, ...migrationModeArgs, "--apply"]);
expect(
  (await readJson(path.join(migrationRoot, "docs/requirements/registry.json"))).schemaVersion === 3,
  "授权后迁移未应用",
);
expect(
  (await readJson(path.join(migrationRoot, "project-status.json"))).currentMode ===
    "continuous-iteration",
  "迁移未记录产品经理确认的持续迭代模式",
);
expect(
  (await readJson(path.join(migrationRoot, ".prototype-kit/manifest.json"))).legacyCompatibility ===
    true,
  "迁移未建立 V0.3 固定版本清单",
);
expect(
  (await readJson(path.join(migrationRoot, "package.json"))).scripts["legacy:check"] ===
    "node legacy-check.mjs",
  "迁移覆盖了旧项目检查命令且未保留兼容入口",
);
expect(
  sha(await fs.readFile(path.join(migrationRoot, "prototype/src/App.jsx"))) ===
    legacyPrototypeChecksum,
  "迁移修改了旧项目原型行为文件",
);
await runNode(".prototype-kit/business-cli.mjs", ["check"], migrationRoot);
await runNode(migrationScript, ["--project", migrationRoot, "--rollback", "latest"]);
expect(
  sha(await fs.readFile(path.join(migrationRoot, "docs/requirements/registry.json"))) ===
    legacyChecksum,
  "迁移回滚未恢复原文件摘要",
);
expect(
  !(await exists(path.join(migrationRoot, ".prototype-kit/manifest.json"))),
  "迁移回滚未移除新增的 V0.3 管理清单",
);
expect(
  !(await exists(path.join(migrationRoot, "docs/business-baseline.md"))),
  "迁移回滚未移除新增的最小基线",
);
expect(
  (await fs.readFile(path.join(migrationRoot, "skills/legacy.txt"), "utf8")).includes("不得丢失"),
  "迁移或回滚丢失了历史内部材料",
);

const ambiguousMigrationRoot = path.join(sandbox, "legacy-needs-one-question");
await fs.mkdir(path.join(ambiguousMigrationRoot, "docs/requirements"), { recursive: true });
await fs.writeFile(
  path.join(ambiguousMigrationRoot, "docs/requirements/registry.json"),
  `${JSON.stringify(
    {
      ...legacyRegistry,
      items: [{ id: "CR-001", currentStageId: "impact-analysis" }],
    },
    null,
    2,
  )}\n`,
);
await fs.writeFile(
  path.join(ambiguousMigrationRoot, "project.config.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      kitVersion: "0.2.0",
      projectName: "待确认迁移",
      paths: { requirements: "docs/requirements/registry.json" },
    },
    null,
    2,
  )}\n`,
);
await expectReject(
  () =>
    runNode(migrationScript, [
      "--project",
      ambiguousMigrationRoot,
      ...migrationModeArgs,
      "--apply",
    ]),
  "缺少风险确认的旧记录不应被迁移",
);
const ambiguityReport = await fs.readFile(
  path.join(ambiguousMigrationRoot, "dist/migrations/v0.2-to-v0.3-impact-report.md"),
  "utf8",
);
expect(ambiguityReport.includes("## 唯一待确认问题"), "无法映射时没有生成唯一待确认问题");
expect(
  (await readJson(path.join(ambiguousMigrationRoot, "docs/requirements/registry.json")))
    .schemaVersion === 2,
  "被阻断的迁移修改了旧台账",
);

const mappedMigrationRoot = path.join(sandbox, "legacy-with-confirmed-map");
await fs.mkdir(path.join(mappedMigrationRoot, "docs/requirements"), { recursive: true });
const oldStageIds = [
  "registered",
  "waiting-start",
  "impact-analysis",
  "rule-confirmation",
  "decision-record",
  "page-contract",
  "interactive-prototype",
  "page-spec",
  "consistency-check",
  "user-review",
  "synced",
];
const mappedLegacyItem = {
  id: "CR-002",
  summary: "迁移已进入影响分析的需求",
  originalRequest: "保留原始请求",
  source: "历史台账",
  proposedAt: "2026-08-01",
  currentStageId: "impact-analysis",
  executionState: "locked",
  aiPolicy: "unassessed",
  waitingReason: null,
  readinessChecklist: [
    "goal-clear",
    "scope-clear",
    "acceptance-testable",
    "dependencies-clear",
    "rules-confirmed",
    "authorization-confirmed",
    "risk-reviewed",
  ].map((id) => ({ id, status: "not-assessed", evidence: [] })),
  artifacts: [],
  pageIds: ["PAGE-LEGACY-001"],
  actionIds: ["ACTION-LEGACY-001"],
  stateIds: [],
  documents: ["docs/legacy.md"],
  evidence: ["会议记录第 3 段"],
  nodes: oldStageIds.map((stageId) => ({
    stageId,
    status: stageId === "impact-analysis" ? "进行中" : "未开始",
    evidence: [],
    result: null,
  })),
};
await fs.writeFile(
  path.join(mappedMigrationRoot, "docs/requirements/registry.json"),
  `${JSON.stringify({ ...legacyRegistry, items: [mappedLegacyItem] }, null, 2)}\n`,
);
await fs.writeFile(
  path.join(mappedMigrationRoot, "project.config.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      kitVersion: "0.2.0",
      projectName: "确定性映射迁移",
      paths: { requirements: "docs/requirements/registry.json" },
    },
    null,
    2,
  )}\n`,
);
await fs.writeFile(
  path.join(mappedMigrationRoot, "package.json"),
  '{"name":"mapped-legacy","private":true,"type":"module"}\n',
);
for (const relativePath of [
  "AGENTS.md",
  "README.md",
  "START-HERE.md",
  "inbox/README.md",
  "prototype/package.json",
  "prototype/src/App.jsx",
]) {
  const target = path.join(mappedMigrationRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${relativePath}\n`);
}
const riskMapPath = path.join(mappedMigrationRoot, "risk-map.json");
await fs.writeFile(
  riskMapPath,
  `${JSON.stringify(
    {
      "CR-002": {
        recommendedLevel: "standard",
        confirmedLevel: "standard",
        triggers: [],
        rationale: "普通页面与规则变更",
        confirmedBy: "测试产品经理",
        confirmedAt: "2026-09-01",
        downgradeReason: null,
        compensationMeasures: [],
      },
    },
    null,
    2,
  )}\n`,
);
await runNode(migrationScript, [
  "--project",
  mappedMigrationRoot,
  ...migrationModeArgs,
  "--risk-map",
  riskMapPath,
  "--apply",
]);
const mappedRegistry = await readJson(
  path.join(mappedMigrationRoot, "docs/requirements/registry.json"),
);
expect(mappedRegistry.schemaVersion === 3, "具有确认映射的旧 CR 未迁移到 Schema v3");
expect(mappedRegistry.items[0].pageIds.length === 0, "分析阶段的历史影响 ID 被提前激活");
expect(
  mappedRegistry.items[0].evidence[0].sourceType === "legacy-reference",
  "旧字符串证据未包装为历史引用",
);
const migrationEvidenceFiles = await fs.readdir(
  path.join(mappedMigrationRoot, ".prototype-kit/migrations"),
);
const migrationEvidence = await readJson(
  path.join(mappedMigrationRoot, ".prototype-kit/migrations", migrationEvidenceFiles[0]),
);
expect(
  migrationEvidence.originalItems[0].pageIds[0] === "PAGE-LEGACY-001",
  "迁移证据未保留原始影响 ID",
);

const highRiskMigrationRoot = path.join(sandbox, "legacy-high-risk-awaiting-review");
await fs.mkdir(path.join(highRiskMigrationRoot, "docs/requirements"), { recursive: true });
const completedBeforeReview = new Set([
  "impact-analysis",
  "rule-confirmation",
  "decision-record",
  "page-contract",
  "interactive-prototype",
  "page-spec",
  "consistency-check",
]);
const highRiskLegacyItem = {
  ...mappedLegacyItem,
  id: "CR-003",
  summary: "迁移高风险待评审需求",
  currentStageId: "user-review",
  pageIds: ["PAGE-LEGACY-003"],
  actionIds: ["ACTION-LEGACY-003"],
  nodes: oldStageIds.map((stageId) => ({
    stageId,
    status: completedBeforeReview.has(stageId) ? "已完成" : "未开始",
    evidence: [],
    result: null,
  })),
};
await fs.writeFile(
  path.join(highRiskMigrationRoot, "docs/requirements/registry.json"),
  `${JSON.stringify({ ...legacyRegistry, items: [highRiskLegacyItem] }, null, 2)}\n`,
);
await fs.writeFile(
  path.join(highRiskMigrationRoot, "project.config.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      kitVersion: "0.2.0",
      projectName: "高风险待评审迁移",
      paths: { requirements: "docs/requirements/registry.json" },
    },
    null,
    2,
  )}\n`,
);
await fs.writeFile(
  path.join(highRiskMigrationRoot, "package.json"),
  '{"name":"high-risk-legacy","private":true,"type":"module"}\n',
);
for (const relativePath of [
  "AGENTS.md",
  "README.md",
  "START-HERE.md",
  "inbox/README.md",
  "prototype/package.json",
  "prototype/src/App.jsx",
]) {
  const target = path.join(highRiskMigrationRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${relativePath}\n`);
}
const highRiskMapPath = path.join(highRiskMigrationRoot, "risk-map.json");
const highRiskMapping = {
  recommendedLevel: "high",
  confirmedLevel: "high",
  triggers: ["lifecycle", "permissions"],
  rationale: "同时触达生命周期和权限边界",
  confirmedBy: "测试产品经理",
  confirmedAt: "2026-09-01",
  downgradeReason: null,
  compensationMeasures: [],
};
await fs.writeFile(highRiskMapPath, `${JSON.stringify({ "CR-003": highRiskMapping }, null, 2)}\n`);
await expectReject(
  () =>
    runNode(migrationScript, [
      "--project",
      highRiskMigrationRoot,
      ...migrationModeArgs,
      "--risk-map",
      highRiskMapPath,
      "--apply",
    ]),
  "无法由旧节点证明的 V0.3 高风险活动不应被自动补成完成",
);
expect(
  (await readJson(path.join(highRiskMigrationRoot, "docs/requirements/registry.json")))
    .schemaVersion === 2,
  "高风险活动待确认时仍修改了旧台账",
);
const highRiskReport = await fs.readFile(
  path.join(highRiskMigrationRoot, "dist/migrations/v0.2-to-v0.3-impact-report.md"),
  "utf8",
);
expect(
  highRiskReport.includes("risk-map.activityOverrides"),
  "高风险活动无法映射时未给出明确补齐入口",
);
await fs.writeFile(
  highRiskMapPath,
  `${JSON.stringify(
    {
      "CR-003": {
        ...highRiskMapping,
        activityOverrides: {
          "domain-model": {
            status: "已完成",
            evidence: ["review:legacy-domain-model"],
            result: "产品经理确认旧项目已覆盖生命周期建模",
          },
          "specialist-review": {
            status: "已跳过",
            evidence: ["review:permissions-not-in-scope"],
            result: "产品经理确认本次旧需求不改变现有权限边界",
          },
        },
      },
    },
    null,
    2,
  )}\n`,
);
await runNode(migrationScript, [
  "--project",
  highRiskMigrationRoot,
  ...migrationModeArgs,
  "--risk-map",
  highRiskMapPath,
  "--apply",
]);
const highRiskMigratedRegistry = await readJson(
  path.join(highRiskMigrationRoot, "docs/requirements/registry.json"),
);
const highRiskActivities = new Map(
  highRiskMigratedRegistry.items[0].activities.map((activity) => [activity.id, activity]),
);
expect(
  highRiskActivities.get("domain-model")?.status === "已完成",
  "显式确认的高风险领域模型活动未迁移",
);
expect(
  highRiskActivities.get("specialist-review")?.status === "已跳过",
  "显式说明理由的专项确认活动未按映射迁移",
);

const upgradeRoot = path.join(sandbox, "upgrade-target");
await createBusinessProject({
  ...rapidValidation,
  name: "升级测试",
  output: upgradeRoot,
  mode: "rapid-validation",
  recommendationReason: "验证升级工具不影响业务事实",
  confirmedBy: "测试产品经理",
  confirmedAt: "2026-09-01T00:00:00.000Z",
});
const baselinePath = path.join(upgradeRoot, "docs/business-baseline.md");
const baselineChecksum = sha(await fs.readFile(baselinePath));
const configPath = path.join(upgradeRoot, "project.config.json");
const manifestPath = path.join(upgradeRoot, ".prototype-kit/manifest.json");
const oldConfig = await readJson(configPath);
oldConfig.kitVersion = "0.2.9";
delete oldConfig.validation;
delete oldConfig.paths.contracts;
delete oldConfig.paths.pageGuides;
const oldConfigContent = Buffer.from(`${JSON.stringify(oldConfig, null, 2)}\n`);
await fs.writeFile(configPath, oldConfigContent);
const oldManifest = await readJson(manifestPath);
oldManifest.kitVersion = "0.2.9";
oldManifest.files = oldManifest.files.filter(
  (entry) => entry.path !== ".prototype-kit/business-cli.mjs",
);
await fs.rm(path.join(upgradeRoot, ".prototype-kit/business-cli.mjs"));
const configEntry = oldManifest.files.find((entry) => entry.path === "project.config.json");
configEntry.sha256 = sha(oldConfigContent);
await fs.writeFile(manifestPath, `${JSON.stringify(oldManifest, null, 2)}\n`);
const oldManifestChecksum = sha(await fs.readFile(manifestPath));
const upgradeScript = path.join(ROOT, "scripts/upgrade-project.mjs");
await runNode(upgradeScript, ["--project", upgradeRoot]);
expect((await readJson(configPath)).kitVersion === "0.2.9", "升级预览修改了固定版本");
await runNode(upgradeScript, ["--project", upgradeRoot, "--apply"]);
expect((await readJson(configPath)).kitVersion === KIT_VERSION, "授权后未升级固定 Kit 版本");
expect(
  (await readJson(configPath)).paths.pageGuides === "docs/page-guides/pages.md",
  "升级没有补齐当前结构字段",
);
expect(
  await exists(path.join(upgradeRoot, ".prototype-kit/business-cli.mjs")),
  "升级没有新增当前版本必需运行时",
);
expect(sha(await fs.readFile(baselinePath)) === baselineChecksum, "Kit 升级修改了业务基线");
await runNode(upgradeScript, ["--project", upgradeRoot, "--restore", "latest"]);
expect(sha(await fs.readFile(manifestPath)) === oldManifestChecksum, "升级恢复未还原原清单摘要");
expect(
  !(await exists(path.join(upgradeRoot, ".prototype-kit/business-cli.mjs"))),
  "升级恢复没有移除本次新增运行时",
);
expect(sha(await fs.readFile(baselinePath)) === baselineChecksum, "升级恢复修改了业务文件");
await fs.appendFile(path.join(upgradeRoot, "README.md"), "\n业务自行修改。\n");
await expectReject(
  () => runNode(upgradeScript, ["--project", upgradeRoot, "--apply"]),
  "被业务修改的 Kit 管理文件不应被升级覆盖",
);
expect((await readJson(configPath)).kitVersion === "0.2.9", "升级冲突仍修改了固定版本");

if (errors.length) {
  console.error(`项目工具测试失败（${errors.length} 项）：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("项目工具测试通过：两种实例、页面说明生成、模式门禁、迁移与升级保护均符合 V0.3 边界");
