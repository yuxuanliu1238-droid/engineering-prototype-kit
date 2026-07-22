import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const releaseBase = `${packageJson.name}-v${packageJson.version}`;
const archiveName = `${releaseBase}.zip`;
const archivePath = path.join(root, "dist", "releases", archiveName);
const checksumPath = `${archivePath}.sha256`;

const archive = await readFile(archivePath);
const expectedChecksum = (await readFile(checksumPath, "utf8")).trim().split(/\s+/)[0];
const actualChecksum = createHash("sha256").update(archive).digest("hex");

if (actualChecksum !== expectedChecksum) {
  throw new Error(`发布包校验和不一致：期望 ${expectedChecksum}，实际 ${actualChecksum}`);
}

const entries = Object.keys(unzipSync(archive));
const prefix = `${releaseBase}/`;
const requiredEntries = [
  "START-HERE.md",
  "README.md",
  "AGENTS.md",
  "package.json",
  "pnpm-lock.yaml",
  "project.config.json",
  "docs/requirements/task-control-model.md",
  "docs/review/v0.2-verification.md",
  "prototype/dist/index.html",
  "skills/prototype-sop-orchestrator/SKILL.md",
  "skills/business-discovery/SKILL.md",
  "skills/decision-and-domain/SKILL.md",
  "skills/page-contract-and-spec/SKILL.md",
  "skills/requirement-quality-review/SKILL.md",
  "skills/change-and-delivery-governance/SKILL.md"
].map((entry) => `${prefix}${entry}`);

const missingEntries = requiredEntries.filter((entry) => !entries.includes(entry));
if (missingEntries.length > 0) {
  throw new Error(`发布包缺少必要文件：\n${missingEntries.join("\n")}`);
}

const forbiddenEntries = entries.filter((entry) => {
  const relative = entry.slice(prefix.length);
  return (
    entry.includes("/node_modules/") ||
    entry.includes("/.git/") ||
    (relative.startsWith("dist/") && !relative.startsWith("prototype/dist/")) ||
    (relative.startsWith("inbox/business/") && !relative.endsWith(".gitkeep")) ||
    (relative.startsWith("inbox/meetings/") && !relative.endsWith(".gitkeep")) ||
    (relative.startsWith("inbox/screenshots/") && !relative.endsWith(".gitkeep")) ||
    (relative.startsWith("inbox/integrations/") && !relative.endsWith(".gitkeep")) ||
    relative.includes(".tmp-browser-check")
  );
});

if (forbiddenEntries.length > 0) {
  throw new Error(`发布包包含不应交付的内容：\n${forbiddenEntries.join("\n")}`);
}

console.log(`发布包有效：${archiveName}`);
console.log(`文件数量：${entries.length}`);
console.log(`SHA-256：${actualChecksum}`);
