import { collectArchiveFiles, validateArchiveEntries } from "./archive-policy.mjs";
import { safePath } from "./safe-path.mjs";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";
import { readJson, ROOT } from "./project-lib.mjs";

const config = await readJson("project.config.json");
const packageJson = await readJson("package.json");
const releaseDirectory = safePath(ROOT, config.paths.releaseOutput);
const archiveName = `engineering-prototype-kit-v${packageJson.version}.zip`;
const archivePath = path.join(releaseDirectory, archiveName);

const files = await collectArchiveFiles(ROOT, "kit", config);

const entries = {};
for (const relativePath of files) {
  const content = await fs.readFile(path.join(ROOT, relativePath));
  entries[`engineering-prototype-kit-v${packageJson.version}/${relativePath}`] = content;
}
const archive = zipSync(entries, { level: 6 });
validateArchiveEntries(
  Object.keys(unzipSync(archive)),
  `engineering-prototype-kit-v${packageJson.version}`,
  "kit",
  config,
);
await fs.mkdir(releaseDirectory, { recursive: true });
await fs.writeFile(safePath(ROOT, path.relative(ROOT, archivePath)), archive);

const hash = createHash("sha256").update(archive).digest("hex");
await fs.writeFile(
  safePath(ROOT, path.relative(ROOT, `${archivePath}.sha256`)),
  `${hash}  ${archiveName}\n`,
  "utf8",
);

console.log(`已生成 ${path.relative(ROOT, archivePath)}（${files.length} 个文件）`);
console.log(`SHA-256 ${hash}`);
