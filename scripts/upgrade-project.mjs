import { parseOptions } from "./cli-lib.mjs";
import { applyTransaction, restoreTransaction, previewGuard } from "./transaction-lib.mjs";
import { runtimeEntries } from "./runtime-manifest.mjs";
import { safePath } from "./safe-path.mjs";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION } from "./project-generator-lib.mjs";
import { ROOT } from "./project-lib.mjs";
import { selectTemplateFiles, templateFileForTarget } from "./template-manifest.mjs";

function parseArgs(argv) {
  const result = parseOptions(argv, { values: ["project", "restore"], flags: ["apply"] });
  return { apply: false, ...result };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function render(content, values) {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

function safeProjectPath(projectRoot, relativePath) {
  return safePath(projectRoot, relativePath);
}

async function restore(projectRoot) {
  const backup = await restoreTransaction(projectRoot, "upgrade");
  console.log(`已恢复升级前文件：${backup}`);
}

async function desiredContent(relativePath, config, status) {
  const values = {
    PROJECT_NAME: config.projectName,
    PACKAGE_NAME: config.packageName,
    KIT_VERSION,
    MODE: status.currentMode,
    INPUT_SUFFICIENCY: status.validationProfile?.inputSufficiency?.level || "sufficient",
    PRIMARY_VALIDATION_FOCUS: status.validationProfile?.primaryFocus || "business-solution",
    REVIEW_CENTER_ENABLED: status.validationProfile?.reviewCenter?.enabled ? "是" : "否",
    REVIEW_CENTER_ENABLED_BOOL: String(status.validationProfile?.reviewCenter?.enabled === true),
    REVIEW_CENTER_REASON:
      status.validationProfile?.reviewCenter?.reason || "当前版本未启用独立评审中心",
  };
  const direct = {
    ...Object.fromEntries(runtimeEntries({ handoff: true }).map((e) => [e.target, e.source])),
    "pnpm-lock.yaml": "pnpm-lock.yaml",
  };
  if (direct[relativePath]) return fs.readFile(path.join(ROOT, direct[relativePath]));
  const material = templateFileForTarget(relativePath);
  if (material?.ownership === "kit-managed") {
    return Buffer.from(render(await fs.readFile(
      path.join(ROOT, "templates/business-project", material.source), "utf8",
    ), values));
  }
  const runtimeTargets = new Set([
    "AGENTS.md",
    "START-HERE.md",
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
  ]);
  if (runtimeTargets.has(relativePath)) {
    const source = await fs.readFile(
      path.join(ROOT, "templates/business-project/runtime", relativePath),
      "utf8",
    );
    return Buffer.from(render(source, values));
  }
  if (relativePath === "project.config.json") {
    const upgradedConfig = {
      ...config,
      schemaVersion: 2,
      instanceKind: "business-project",
      kitVersion: KIT_VERSION,
      paths: {
        ...(config.paths || {}),
        contracts: config.paths?.contracts || "prototype/src/contracts/contracts.json",
        pageGuides: config.paths?.pageGuides || "docs/page-guides/pages.md",
        demoBlueprint: config.paths?.demoBlueprint || "docs/demo-blueprint.md",
        reviewScenarios: config.paths?.reviewScenarios || "prototype/src/review-scenarios.json",
        developmentHandoff:
          config.paths?.developmentHandoff || "docs/development/development-handoff.json",
        developmentTaskList:
          config.paths?.developmentTaskList || "docs/development/development-task-list.md",
        developmentTaskContexts:
          config.paths?.developmentTaskContexts || "docs/development/task-contexts",
        developmentTaskPrompts:
          config.paths?.developmentTaskPrompts || "docs/development/task-prompts",
      },
      optionalCapabilities: {
        ...(config.optionalCapabilities || {}),
        developmentHandoff: {
          available: true,
          defaultEnabled: false,
          activation: "explicit-product-confirmation",
        },
      },
      validation: {
        allowedSurfaces: config.validation?.allowedSurfaces || [
          "mobile",
          "admin",
          "web",
          "service",
        ],
        implementationStatuses: config.validation?.implementationStatuses || [
          "implemented",
          "partial",
          "planned",
        ],
      },
    };
    return Buffer.from(`${JSON.stringify(upgradedConfig, null, 2)}\n`);
  }
  return null;
}

function currentManagedPaths(status) {
  const runtimePaths = [...runtimeEntries().map((e) => e.target), "project.config.json"];
  if (status.capabilities?.developmentHandoff?.enabled === true) {
    runtimePaths.push(
      ...runtimeEntries({ handoff: true })
        .filter((e) => e.capability)
        .map((e) => e.target),
    );
  }
  if (status.legacyCompatibility === true) return runtimePaths;
  const paths = [
    ...runtimePaths,
    "AGENTS.md",
    "START-HERE.md",
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
  ];
  paths.push(...selectTemplateFiles({
    mode: status.currentMode,
    activations: status.capabilities?.developmentHandoff?.enabled ? ["development-handoff"] : [],
  }).filter((entry) => entry.ownership === "kit-managed").map((entry) => entry.target));
  return paths;
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) throw new Error("缺少业务项目路径 --project");
const projectRoot = path.resolve(args.project);
if (args.restore === "latest") {
  await restore(projectRoot);
  process.exit(0);
}

const configPath = safePath(projectRoot, "project.config.json");
const statusPath = safePath(projectRoot, "project-status.json");
const manifestPath = safePath(projectRoot, ".prototype-kit/manifest.json");
const config = await readJson(configPath);
const status = await readJson(statusPath);
const manifest = await readJson(manifestPath);
if (config.instanceKind !== "business-project") throw new Error("目标不是可升级的业务项目实例");
status.legacyCompatibility = manifest.legacyCompatibility === true;
const preflight = await previewGuard(
  projectRoot,
  "upgrade",
  [
    ...new Set([
      "project.config.json",
      "project-status.json",
      ".prototype-kit/manifest.json",
      ...manifest.files.filter((e) => e.ownership === "kit-managed").map((e) => e.path),
    ]),
  ],
  args.apply,
);

const conflicts = [];
const changes = [];
const skipped = [];
if (!status.validationProfile) {
  conflicts.push(
    "project-status.json 缺少已确认的评审目标和输入充分度；升级前需由产品经理确认 validationProfile，升级工具不得自行补写业务判断",
  );
}
const manifestEntries = new Map((manifest.files || []).map((entry) => [entry.path, entry]));
for (const entry of manifest.files || []) {
  if (entry.ownership !== "kit-managed") continue;
  let absolutePath;
  try {
    absolutePath = safeProjectPath(projectRoot, entry.path);
  } catch (error) {
    conflicts.push(error.message);
    continue;
  }
  let current;
  try {
    current = await fs.readFile(absolutePath);
  } catch {
    conflicts.push(`${entry.path} 已缺失`);
    continue;
  }
  if (sha256(current) !== entry.sha256) {
    conflicts.push(`${entry.path} 在业务项目中被修改`);
    continue;
  }
  const desired = await desiredContent(entry.path, config, status);
  if (!desired) {
    skipped.push(entry.path);
    continue;
  }
  if (sha256(current) !== sha256(desired)) changes.push({ entry, content: desired, existed: true });
}

for (const relativePath of currentManagedPaths(status)) {
  if (manifestEntries.has(relativePath)) {
    if (manifestEntries.get(relativePath).ownership !== "kit-managed") {
      conflicts.push(`${relativePath} 应为 Kit 管理文件，但旧清单记录了其他归属`);
    }
    continue;
  }
  const target = safeProjectPath(projectRoot, relativePath);
  try {
    await fs.access(target);
    conflicts.push(`${relativePath} 已存在但不在旧 Kit 管理清单中`);
    continue;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const content = await desiredContent(relativePath, config, status);
  if (!content) {
    conflicts.push(`${relativePath} 缺少当前版本的确定性来源`);
    continue;
  }
  changes.push({
    entry: { path: relativePath, ownership: "kit-managed", sha256: null },
    content,
    existed: false,
  });
}

const reportDirectory = safePath(projectRoot, "dist/upgrades");
await fs.mkdir(reportDirectory, { recursive: true });
const reportPath = path.join(
  reportDirectory,
  `kit-${manifest.kitVersion}-to-${KIT_VERSION}-preview.md`,
);
const report = [
  "# Kit 升级预览",
  "",
  `- 当前固定版本：${manifest.kitVersion}`,
  `- 目标版本：${KIT_VERSION}`,
  `- 将更新的 Kit 管理文件：${changes.length}`,
  `- 不会更新的业务文件：${(manifest.files || []).filter((entry) => entry.ownership !== "kit-managed").length}`,
  "",
  "## 计划更新",
  "",
  ...(changes.length
    ? changes.map(({ entry, existed }) => `- ${existed ? "更新" : "新增"}：${entry.path}`)
    : ["- 无"]),
];
if (skipped.length)
  report.push("", "## 保留的未知旧运行时", "", ...skipped.map((item) => `- ${item}`));
if (conflicts.length) {
  report.push(
    "",
    "## 唯一待确认问题",
    "",
    `以下 Kit 管理文件与固定版本摘要不一致，请确认保留业务修改还是恢复 Kit 版本后再升级：${conflicts.join("；")}。`,
  );
}
await fs.writeFile(
  safePath(projectRoot, path.relative(projectRoot, reportPath)),
  `${report.join("\n")}\n`,
  "utf8",
);
console.log(`已生成升级预览：${reportPath}`);

if (!args.apply) {
  console.log("当前仅预览；明确授权后增加 --apply 才会更新 Kit 管理文件。");
  process.exit(conflicts.length ? 1 : 0);
}
if (conflicts.length) throw new Error(`升级被阻断：${conflicts[0]}`);

const timestamp = new Date().toISOString();
const entries = new Map((manifest.files || []).map((entry) => [entry.path, entry]));
const writes = new Map();
for (const change of changes) {
  writes.set(change.entry.path, change.content);
  entries.set(change.entry.path, { ...change.entry, sha256: sha256(change.content) });
  if (!change.existed) preflight[change.entry.path] = null;
}
manifest.kitVersion = KIT_VERSION;
manifest.upgradedAt = timestamp;
manifest.files = [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
writes.set(".prototype-kit/manifest.json", Buffer.from(JSON.stringify(manifest, null, 2) + "\n"));
const backup = await applyTransaction(projectRoot, "upgrade", writes, { expected: preflight });
console.log(`Kit 管理文件已升级到 ${KIT_VERSION}；备份位于 ${backup}`);
