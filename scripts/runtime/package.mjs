import { collectArchiveFiles, validateArchiveEntries } from "../archive-policy.mjs";
import { safePath } from "../safe-path.mjs";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, ROOT } from "../project-lib.mjs";

import { validateProject } from "./validate.mjs";

export async function packageReview() {
  await validateProject({ strict: true });
  if (process.exitCode) throw new Error("项目检查失败，未生成评审包");

  const config = await readJson("project.config.json");
  const { runChecks, evaluateCheckReport } = await import("../check-runner.mjs");
  const report = await runChecks({
    root: ROOT,
    target: "delivery",
    commands: [
      { command: process.execPath, args: [".prototype-kit/business-cli.mjs", "check"] },
      { command: "pnpm", args: ["--dir", "prototype", "build"] },
    ],
    cache: false,
  });
  if (!(await evaluateCheckReport(report, { root: ROOT })).valid)
    throw new Error("交付前实际检查未通过");
  const { zipSync, unzipSync } = await import("fflate");
  const files = await collectArchiveFiles(ROOT, "business", config);
  if (!files.includes("prototype/dist/index.html")) throw new Error("缺少构建产物，请先运行 build");
  const base = `${config.packageName}-review`;
  const entries = {};
  for (const relativePath of files) {
    const content = await fs.readFile(path.join(ROOT, relativePath));
    entries[`${base}/${relativePath}`] = content;
  }
  const archive = zipSync(entries, { level: 6 });
  validateArchiveEntries(Object.keys(unzipSync(archive)), base, "business", config);
  const outputDirectory = safePath(ROOT, config.paths.releaseOutput || "dist/review");
  const archivePath = path.join(outputDirectory, `${base}.zip`);
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(safePath(ROOT, path.relative(ROOT, archivePath)), archive);
  const checksum = createHash("sha256").update(archive).digest("hex");
  await fs.writeFile(
    safePath(ROOT, path.relative(ROOT, `${archivePath}.sha256`)),
    `${checksum}  ${path.basename(archivePath)}\n`,
    "utf8",
  );
  console.log(`已生成业务项目评审包：${path.relative(ROOT, archivePath)}`);
}
