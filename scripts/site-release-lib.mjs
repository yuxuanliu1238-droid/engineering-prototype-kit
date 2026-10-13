import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { forbiddenArchivePath } from "./archive-policy.mjs";

const exec = promisify(execFile);

async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, "utf8"));
}

async function inspectDirectory(directory, { rejectSensitive = false } = {}) {
  let newest = 0;
  const forbidden = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      const relative = path.relative(directory, target).split(path.sep).join("/");
      if (entry.isSymbolicLink()) throw new Error(`目录不能包含符号链接：${target}`);
      if (
        rejectSensitive &&
        (forbiddenArchivePath(relative) || relative.split("/").includes("audit"))
      ) {
        forbidden.push(relative);
      }
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) newest = Math.max(newest, (await fs.stat(target)).mtimeMs);
    }
  }
  await visit(directory);
  return { newest, forbidden };
}

async function gitOutput(root, args) {
  try {
    return { ok: true, stdout: (await exec("git", args, { cwd: root, maxBuffer: 4 * 1024 * 1024 })).stdout };
  } catch {
    return { ok: false, stdout: "" };
  }
}

export async function inspectSiteRelease(root) {
  const errors = [];
  const manifestPath = path.join(root, ".openai/hosting.json");
  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch (error) {
    return { errors: [`无法读取 .openai/hosting.json：${error.message}`], report: null };
  }
  if (typeof manifest.project_id !== "string" || !manifest.project_id.trim()) {
    errors.push("hosting.json 缺少 project_id");
  }
  const staticDirectory = manifest.static?.directory;
  if (typeof staticDirectory !== "string" || !staticDirectory.trim()) {
    errors.push("hosting.json 缺少 static.directory");
  }
  const resolvedStatic = staticDirectory ? path.resolve(root, staticDirectory) : root;
  const relativeStatic = path.relative(root, resolvedStatic);
  if (
    (staticDirectory && path.isAbsolute(staticDirectory)) ||
    relativeStatic.startsWith("..") ||
    path.isAbsolute(relativeStatic)
  ) {
    errors.push("static.directory 必须是项目内的相对目录");
  }
  let indexMtime = 0;
  let buildMtime = 0;
  try {
    indexMtime = (await fs.stat(path.join(resolvedStatic, "index.html"))).mtimeMs;
  } catch {
    errors.push(`站点构建目录缺少 index.html：${staticDirectory || "未配置"}`);
  }
  try {
    const build = await inspectDirectory(resolvedStatic, { rejectSensitive: true });
    buildMtime = build.newest;
    if (build.forbidden.length) {
      errors.push(`发布目录包含不应发布的文件：${build.forbidden.join("、")}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") errors.push(error.message);
  }

  const sourceRoot = path.join(root, "prototype/src");
  try {
    const sourceMtime = (await inspectDirectory(sourceRoot)).newest;
    if (buildMtime && sourceMtime > buildMtime) errors.push("站点构建产物早于 prototype/src，请重新构建");
  } catch (error) {
    if (error.code !== "ENOENT") errors.push(error.message);
  }

  const trackedResult = await gitOutput(root, ["ls-files", "-z"]);
  const tracked = trackedResult.stdout
    .split("\0")
    .filter(Boolean);
  const forbiddenTracked = tracked.filter(
    (file) =>
      file === ".DS_Store" ||
      file.includes("/.DS_Store") ||
      /(^|\/)\.env(?:\.|$)/i.test(file) ||
      file.startsWith("audit/") ||
      /\.(?:pem|key|p12)$/i.test(file),
  );
  if (forbiddenTracked.length) {
    errors.push(`源码包含不应发布的文件：${forbiddenTracked.join("、")}`);
  }
  const statusResult = await gitOutput(root, ["status", "--porcelain"]);
  const dirtyFiles = statusResult.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3));

  return {
    errors,
    report: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      projectId: manifest.project_id || null,
      staticDirectory: staticDirectory || null,
      indexPresent: indexMtime > 0,
      sourceStatus: !statusResult.ok ? "unavailable" : dirtyFiles.length ? "changes-present" : "clean",
      dirtyFiles,
      forbiddenTrackedFiles: forbiddenTracked,
      localChecksPassed: errors.length === 0,
      requiredExternalChecks: [
        "发布前推送与构建产物完全一致的源码提交",
        "保持站点现有访问范围，除非用户明确要求改变",
        "发布后读取部署状态、版本号和正式地址",
        "对正式地址执行页面打开、关键入口和控制台冒烟检查",
      ],
    },
  };
}

export async function checkSiteReleaseProject(root, { writeReceipt = true, print = true } = {}) {
  const { errors, report } = await inspectSiteRelease(root);
  if (writeReceipt && report) {
    const output = path.join(root, ".sites-runtime/site-release-preflight.json");
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (print) {
    if (errors.length) {
      console.error(`站点发布前检查失败（${errors.length} 项）：`);
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `站点发布前检查通过：${report.staticDirectory}，源码状态 ${report.sourceStatus}；访问范围和线上状态仍须在 Sites 发布后核对`,
      );
    }
  }
  return errors;
}
