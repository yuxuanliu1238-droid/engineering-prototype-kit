import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION } from "./project-generator-lib.mjs";
import { ROOT } from "./project-lib.mjs";

function parseArgs(argv) {
  const result = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") result.apply = true;
    else if (arg.startsWith("--")) {
      result[arg.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return result;
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
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (absolutePath !== projectRoot && !absolutePath.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error(`管理清单路径越出目标项目：${relativePath}`);
  }
  return absolutePath;
}

async function latestBackup(projectRoot) {
  const root = path.join(projectRoot, ".prototype-kit", "backups");
  const entries = (await fs.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("upgrade-"))
    .map((entry) => entry.name)
    .sort();
  return entries.at(-1) ? path.join(root, entries.at(-1)) : null;
}

async function restore(projectRoot) {
  const backupRoot = await latestBackup(projectRoot);
  if (!backupRoot) throw new Error("没有可恢复的 Kit 升级备份");
  const backup = await readJson(path.join(backupRoot, "backup-manifest.json"));
  for (const entry of backup.files) {
    const target = safeProjectPath(projectRoot, entry.path);
    if (entry.existed === false) {
      await fs.rm(target, { force: true });
      continue;
    }
    const source = path.join(backupRoot, "files", entry.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    if (sha256(await fs.readFile(target)) !== entry.sha256) {
      throw new Error(`恢复摘要不一致：${entry.path}`);
    }
  }
  console.log(`已恢复升级前文件：${path.basename(backupRoot)}`);
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
    REVIEW_CENTER_REASON: status.validationProfile?.reviewCenter?.reason || "当前版本未启用独立评审中心",
  };
  const direct = {
    ".prototype-kit/project-lib.mjs": "scripts/project-lib.mjs",
    ".prototype-kit/workflow-v3-lib.mjs": "scripts/workflow-v3-lib.mjs",
    ".prototype-kit/contract-lib.mjs": "scripts/contract-lib.mjs",
    ".prototype-kit/page-guide-lib.mjs": "scripts/page-guide-lib.mjs",
    ".prototype-kit/rapid-validation-lib.mjs": "scripts/rapid-validation-lib.mjs",
    ".prototype-kit/business-cli.mjs": "scripts/business-runtime.mjs",
    "pnpm-lock.yaml": "pnpm-lock.yaml",
    "docs/requirements/README.md": "templates/business-project/continuous/docs/requirements/README.md",
    "docs/page-guides/README.md": "templates/business-project/continuous/docs/page-guides/README.md",
  };
  if (direct[relativePath]) return fs.readFile(path.join(ROOT, direct[relativePath]));
  const runtimeTargets = new Set([
    "AGENTS.md",
    "START-HERE.md",
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
  ]);
  if (runtimeTargets.has(relativePath)) {
    const source = await fs.readFile(path.join(ROOT, "templates/business-project/runtime", relativePath), "utf8");
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
      },
      validation: {
        allowedSurfaces: config.validation?.allowedSurfaces || ["mobile", "admin", "web", "service"],
        implementationStatuses: config.validation?.implementationStatuses || ["implemented", "partial", "planned"],
      },
    };
    return Buffer.from(`${JSON.stringify(upgradedConfig, null, 2)}\n`);
  }
  return null;
}

function currentManagedPaths(status) {
  const runtimePaths = [
    ".prototype-kit/project-lib.mjs",
    ".prototype-kit/workflow-v3-lib.mjs",
    ".prototype-kit/contract-lib.mjs",
    ".prototype-kit/page-guide-lib.mjs",
    ".prototype-kit/rapid-validation-lib.mjs",
    ".prototype-kit/business-cli.mjs",
    "project.config.json",
  ];
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
  if (status.currentMode === "continuous-iteration") {
    paths.push("docs/requirements/README.md", "docs/page-guides/README.md");
  }
  return paths;
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) throw new Error("缺少业务项目路径 --project");
const projectRoot = path.resolve(args.project);
if (args.restore === "latest") {
  await restore(projectRoot);
  process.exit(0);
}

const configPath = path.join(projectRoot, "project.config.json");
const statusPath = path.join(projectRoot, "project-status.json");
const manifestPath = path.join(projectRoot, ".prototype-kit", "manifest.json");
const config = await readJson(configPath);
const status = await readJson(statusPath);
const manifest = await readJson(manifestPath);
if (config.instanceKind !== "business-project") throw new Error("目标不是 V0.3 业务项目实例");
status.legacyCompatibility = manifest.legacyCompatibility === true;

const conflicts = [];
const changes = [];
const skipped = [];
if (!status.validationProfile) {
  conflicts.push("project-status.json 缺少已确认的评审目标和输入充分度；升级前需由产品经理确认 validationProfile，升级工具不得自行补写业务判断");
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

const reportDirectory = path.join(projectRoot, "dist", "upgrades");
await fs.mkdir(reportDirectory, { recursive: true });
const reportPath = path.join(reportDirectory, `kit-${manifest.kitVersion}-to-${KIT_VERSION}-preview.md`);
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
  ...(changes.length ? changes.map(({ entry, existed }) => `- ${existed ? "更新" : "新增"}：${entry.path}`) : ["- 无"]),
];
if (skipped.length) report.push("", "## 保留的未知旧运行时", "", ...skipped.map((item) => `- ${item}`));
if (conflicts.length) {
  report.push(
    "",
    "## 唯一待确认问题",
    "",
    `以下 Kit 管理文件与固定版本摘要不一致，请确认保留业务修改还是恢复 Kit 版本后再升级：${conflicts.join("；")}。`,
  );
}
await fs.writeFile(reportPath, `${report.join("\n")}\n`, "utf8");
console.log(`已生成升级预览：${reportPath}`);

if (!args.apply) {
  console.log("当前仅预览；明确授权后增加 --apply 才会更新 Kit 管理文件。");
  process.exit(conflicts.length ? 1 : 0);
}
if (conflicts.length) throw new Error(`升级被阻断：${conflicts[0]}`);

const timestamp = new Date().toISOString();
const backupRoot = path.join(projectRoot, ".prototype-kit", "backups", `upgrade-${timestamp.replaceAll(":", "-")}`);
const backupPaths = [...new Set([...changes.map(({ entry }) => entry.path), ".prototype-kit/manifest.json"])]
  .filter(Boolean);
const backupManifest = { createdAt: timestamp, files: [] };
for (const relativePath of backupPaths) {
  const source = safeProjectPath(projectRoot, relativePath);
  try {
    const content = await fs.readFile(source);
    const target = path.join(backupRoot, "files", relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    backupManifest.files.push({ path: relativePath, existed: true, sha256: sha256(content) });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    backupManifest.files.push({ path: relativePath, existed: false, sha256: null });
  }
}
await fs.mkdir(backupRoot, { recursive: true });
await fs.writeFile(path.join(backupRoot, "backup-manifest.json"), `${JSON.stringify(backupManifest, null, 2)}\n`, "utf8");

const entries = new Map((manifest.files || []).map((entry) => [entry.path, entry]));
for (const change of changes) {
  const target = safeProjectPath(projectRoot, change.entry.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, change.content);
  entries.set(change.entry.path, { ...change.entry, sha256: sha256(change.content) });
}
manifest.kitVersion = KIT_VERSION;
manifest.upgradedAt = timestamp;
manifest.files = [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Kit 管理文件已升级到 ${KIT_VERSION}；备份位于 ${path.relative(projectRoot, backupRoot)}`);
