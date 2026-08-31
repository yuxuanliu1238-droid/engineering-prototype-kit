import { promises as fs } from "node:fs";
import path from "node:path";
import {
  hasText,
  pathExists,
  printResult,
  readJson,
  ROOT,
  walk,
} from "./project-lib.mjs";

const errors = [];
const requiredPaths = [
  "START-HERE.md",
  "README.md",
  "AGENTS.md",
  "project.config.json",
  "project-status.json",
  "inbox/README.md",
  "docs/discovery/business-facts.md",
  "docs/decisions/positive.md",
  "docs/decisions/negative.md",
  "docs/domain/state-machines.md",
  "docs/requirements/registry.json",
  "docs/requirements/task-control-model.md",
  "docs/review/review-baseline.md",
  "docs/review/change-request-flow.md",
  "docs/review/evidence-and-review-packages.md",
  "docs/technical-review/package-manager-compatibility.md",
  "docs/governance/scope-current.md",
  "prototype/package.json",
  "prototype/src/contracts/index.js",
  "skills/prototype-sop-orchestrator/SKILL.md",
  "scripts/source-fingerprint.mjs",
  "scripts/review-package.mjs",
];

for (const relativePath of requiredPaths) {
  if (!(await pathExists(relativePath))) errors.push(`缺少必需路径：${relativePath}`);
}

const config = await readJson("project.config.json");
const packageJson = await readJson("package.json");
if (config.schemaVersion !== 1) errors.push("project.config.json schemaVersion 必须为 1");
if (!hasText(config.projectName)) errors.push("projectName 必须存在");
if (config.packageManager !== "pnpm") errors.push("V0.2 只支持 pnpm");
if (config.prototypeFramework !== "react-vite") errors.push("V0.2 只支持 react-vite");
if (config.kitVersion !== packageJson.version) {
  errors.push("project.config.json kitVersion 必须与 package.json version 一致");
}
if (config.versioning?.versionAuthority !== "package.json") {
  errors.push("versioning.versionAuthority 必须为 package.json");
}
if (config.versioning?.directoryNameIsVersionAuthority !== false) {
  errors.push("目录名不得作为套件版本权威");
}
if (!/^pnpm@\d+\.\d+\.\d+$/.test(packageJson.packageManager ?? "")) {
  errors.push("package.json packageManager 必须声明精确 pnpm 版本");
}
if (!hasText(config.versioning?.legacyDirectoryName)) {
  errors.push("versioning.legacyDirectoryName 必须记录历史目录名");
}

const status = await readJson("project-status.json");
const stages = [
  "initialization",
  "business-discovery",
  "demo-planning",
  "prototype",
  "decision-domain",
  "page-contract",
  "quality-review",
  "user-review",
  "delivery",
];
if (!stages.includes(status.currentStage)) errors.push("project-status.currentStage 无效");
if (!["waiting-user", "in-progress", "completed", "blocked"].includes(status.stageStatus)) {
  errors.push("project-status.stageStatus 无效");
}

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /[?&](?:token|key|secret|password)=[^&\s]+/i,
];
const scanFiles = await walk(".", {
  exclude: (relativePath, entry) =>
    entry.isDirectory() &&
    ["node_modules", "dist", ".git", "inbox"].includes(path.basename(relativePath)),
});

for (const relativePath of scanFiles) {
  if (/\.(png|jpg|jpeg|gif|webp|zip|gz|woff2?)$/i.test(relativePath)) continue;
  const content = await fs.readFile(path.join(ROOT, relativePath), "utf8");
  if (secretPatterns.some((pattern) => pattern.test(content))) {
    errors.push(`疑似包含敏感信息：${relativePath}`);
  }
}

printResult("项目结构校验", errors, `${requiredPaths.length} 个必需入口，未发现敏感信息模式`);
