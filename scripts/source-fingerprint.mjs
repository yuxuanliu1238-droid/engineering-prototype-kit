import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./project-lib.mjs";

function normalizePath(root, filename) {
  if (typeof filename !== "string" || !filename.trim() || path.isAbsolute(filename)) {
    throw new Error(`覆盖文件必须是项目内相对路径：${filename}`);
  }
  const absolutePath = path.resolve(root, filename);
  const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
  if (relativePath === ".." || relativePath.startsWith("../")) {
    throw new Error(`覆盖文件超出项目目录：${filename}`);
  }
  return { absolutePath, relativePath };
}

export async function fingerprintSources(files, options = {}) {
  const root = options.root || ROOT;
  const normalized = [...new Set(files)].map((filename) => normalizePath(root, filename));
  normalized.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const coveredFiles = [];
  for (const file of normalized) {
    try {
      const content = await fs.readFile(file.absolutePath);
      coveredFiles.push({
        path: file.relativePath,
        bytes: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      coveredFiles.push({ path: file.relativePath, missing: true });
    }
  }
  const sourceFingerprint = createHash("sha256")
    .update(JSON.stringify(coveredFiles))
    .digest("hex");
  return { algorithm: "sha256", sourceFingerprint, coveredFiles };
}

export async function createCheckReport({ id, command, files, result, executedAt, root = ROOT }) {
  if (!id || !command || !executedAt) throw new Error("检查报告缺少 id、command 或 executedAt");
  if (!["passed", "failed"].includes(result)) throw new Error("检查结果必须是 passed 或 failed");
  return {
    schemaVersion: "1.0",
    id,
    executedAt,
    command,
    result,
    ...(await fingerprintSources(files, { root })),
  };
}

export async function evaluateFreshness(report, options = {}) {
  if (!report?.sourceFingerprint || !Array.isArray(report.coveredFiles)) {
    return { status: "unknown", reason: "报告缺少源码指纹或覆盖文件" };
  }
  const current = await fingerprintSources(report.coveredFiles.map((file) => file.path), options);
  if (current.coveredFiles.some((file) => file.missing)) {
    return { status: "missing", reason: "至少一个覆盖文件已不存在", current };
  }
  if (current.sourceFingerprint !== report.sourceFingerprint) {
    return { status: "stale", reason: "覆盖文件已发生变化", current };
  }
  return { status: "fresh", reason: "覆盖文件与检查时一致", current };
}

function parseArgs(args) {
  const values = { files: [] };
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (key === "--file") values.files.push(value), index += 1;
    else if (["--id", "--command", "--result", "--executed-at", "--output"].includes(key)) {
      values[key.slice(2).replace("executed-at", "executedAt")] = value;
      index += 1;
    } else throw new Error(`未知参数：${key}`);
  }
  return values;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.output || !args.files.length) throw new Error("必须提供 --output 和至少一个 --file");
  const report = await createCheckReport({
    id: args.id,
    command: args.command,
    files: args.files,
    result: args.result,
    executedAt: args.executedAt,
  });
  const outputPath = path.resolve(ROOT, args.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`检查报告已生成：${path.relative(ROOT, outputPath)}`);
}
