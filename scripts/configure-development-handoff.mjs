import { parseOptions } from "./cli-lib.mjs";
import { runtimeEntries } from "./runtime-manifest.mjs";
import os from "node:os";
import { applyTransaction, restoreTransaction, previewGuard } from "./transaction-lib.mjs";
import { safePath } from "./safe-path.mjs";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { addDevelopmentHandoffStructure, KIT_VERSION } from "./project-generator-lib.mjs";

function parseArgs(argv) {
  const result = parseOptions(argv, {
    values: ["project", "restore", "reason", "confirmed-by"],
    flags: ["apply"],
  });
  return { apply: false, ...result };
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function safeProjectPath(projectRoot, relativePath) {
  return safePath(projectRoot, relativePath);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function restore(projectRoot) {
  console.log(await restoreTransaction(projectRoot, "handoff-activation"));
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) throw new Error("缺少业务项目路径 --project");
const projectRoot = path.resolve(args.project);
if (args.restore === "latest") {
  await restore(projectRoot);
  process.exit(0);
}
if (!args.reason?.trim()) throw new Error("缺少启用原因 --reason");
if (!args["confirmed-by"]?.trim()) throw new Error("缺少产品确认人 --confirmed-by");

const configPath = safePath(projectRoot, "project.config.json");
const statusPath = safePath(projectRoot, "project-status.json");
const manifestPath = safePath(projectRoot, ".prototype-kit/manifest.json");
const config = await readJson(configPath);
const status = await readJson(statusPath);
const manifest = await readJson(manifestPath);
const preflight = await previewGuard(
  projectRoot,
  "handoff-activation",
  ["project.config.json", "project-status.json", ".prototype-kit/manifest.json"],
  args.apply,
);
const conflicts = [];
if (config.instanceKind !== "business-project") conflicts.push("目标不是业务项目实例");
if (config.kitVersion !== KIT_VERSION || manifest.kitVersion !== KIT_VERSION) {
  conflicts.push(`业务项目必须先升级并固定到 Kit ${KIT_VERSION}`);
}
if (status.currentMode !== "continuous-iteration") conflicts.push("快速验证项目不能启用产研交接");
if (status.capabilities?.developmentHandoff?.enabled === true)
  conflicts.push("当前项目已经启用产研交接");

const addedPaths = [
  "docs/development/README.md",
  config.paths.developmentHandoff || "docs/development/development-handoff.json",
  config.paths.developmentTaskList || "docs/development/development-task-list.md",
  ...runtimeEntries({ handoff: true })
    .filter((e) => e.capability)
    .map((e) => e.target),
];
for (const relativePath of addedPaths) {
  if (await exists(safeProjectPath(projectRoot, relativePath))) {
    conflicts.push(`目标路径已存在，不能自动覆盖：${relativePath}`);
  }
}

const reportDirectory = safePath(projectRoot, "dist/upgrades");
await fs.mkdir(reportDirectory, { recursive: true });
const reportPath = path.join(reportDirectory, "development-handoff-activation-preview.md");
const report = [
  "# 产研交接启用预览",
  "",
  `- Kit 版本：${config.kitVersion}`,
  `- 当前模式：${status.currentMode}`,
  `- 产品确认人：${args["confirmed-by"]}`,
  `- 启用原因：${args.reason}`,
  "- 默认行为：只创建草稿和生成能力，不确认开发范围，也不授权实施",
  "",
  "## 将新增",
  "",
  ...addedPaths.map((item) => `- ${item}`),
];
if (conflicts.length) report.push("", "## 阻断", "", ...conflicts.map((item) => `- ${item}`));
await fs.writeFile(
  safePath(projectRoot, path.relative(projectRoot, reportPath)),
  `${report.join("\n")}\n`,
  "utf8",
);
console.log(`已生成启用预览：${reportPath}`);

if (!args.apply) {
  console.log("当前仅预览；明确授权后增加 --apply 才会启用产研交接。");
  process.exit(conflicts.length ? 1 : 0);
}
if (conflicts.length) throw new Error(`启用被阻断：${conflicts[0]}`);

const timestamp = new Date().toISOString();
const staging = await fs.mkdtemp(path.join(os.tmpdir(), "kit-handoff-"));
const writes = new Map();
let newFiles;
try {
  newFiles = await addDevelopmentHandoffStructure(staging, {
    projectName: config.projectName,
    timestamp,
    paths: config.paths,
  });
  for (const entry of newFiles) {
    writes.set(entry.path, await fs.readFile(safePath(staging, entry.path)));
    preflight[entry.path] = null;
  }
} finally {
  await fs.rm(staging, { recursive: true, force: true });
}
status.capabilities = {
  ...(status.capabilities || {}),
  developmentHandoff: {
    enabled: true,
    state: "confirmed",
    reason: args.reason.trim(),
    confirmedBy: args["confirmed-by"].trim(),
    confirmedAt: timestamp,
  },
};
status.updatedAt = timestamp;
const statusContent = Buffer.from(JSON.stringify(status, null, 2) + "\n");
writes.set("project-status.json", statusContent);
const entries = new Map((manifest.files || []).map((e) => [e.path, e]));
for (const entry of newFiles) entries.set(entry.path, entry);
if (entries.has("project-status.json"))
  entries.get("project-status.json").sha256 = sha256(statusContent);
manifest.files = [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
manifest.handoffActivatedAt = timestamp;
writes.set(".prototype-kit/manifest.json", Buffer.from(JSON.stringify(manifest, null, 2) + "\n"));
await applyTransaction(projectRoot, "handoff-activation", writes, { expected: preflight });
console.log("产研交接已启用；只生成草稿，未授权实施。");
