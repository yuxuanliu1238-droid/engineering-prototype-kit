import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { readJson, ROOT, walk } from "./project-lib.mjs";

const config = await readJson("project.config.json");
const packageJson = await readJson("package.json");
const releaseDirectory = path.join(ROOT, config.paths.releaseOutput);
const archiveName = `engineering-prototype-kit-v${packageJson.version}.zip`;
const archivePath = path.join(releaseDirectory, archiveName);

const files = await walk(".", {
  exclude: (relativePath, entry) => {
    const segments = relativePath.split("/");
    if (entry.isDirectory() && [".git", "node_modules"].includes(entry.name)) return true;
    if (segments[0] === "dist") return true;
    if (
      segments[0] === "inbox" &&
      relativePath !== "inbox" &&
      relativePath !== "inbox/README.md"
    ) return true;
    if (segments.includes("node_modules")) return true;
    return false;
  },
});

const entries = {};
for (const relativePath of files) {
  const content = await fs.readFile(path.join(ROOT, relativePath));
  entries[`engineering-prototype-kit-v${packageJson.version}/${relativePath}`] =
    content;
}
const archive = zipSync(entries, { level: 6 });
await fs.mkdir(releaseDirectory, { recursive: true });
await fs.writeFile(archivePath, archive);

const hash = createHash("sha256").update(archive).digest("hex");
await fs.writeFile(`${archivePath}.sha256`, `${hash}  ${archiveName}\n`, "utf8");

console.log(`已生成 ${path.relative(ROOT, archivePath)}（${files.length} 个文件）`);
console.log(`SHA-256 ${hash}`);
