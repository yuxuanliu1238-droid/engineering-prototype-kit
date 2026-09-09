import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fingerprintSources } from "./source-fingerprint.mjs";
import { safePath } from "./safe-path.mjs";
import { parseOptions, issue } from "./cli-lib.mjs";
const exec = promisify(execFile);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function captureInputs(root) {
  const files = [];
  const excluded = new Set(["node_modules", ".git", "dist", "backups", "checks", ".transactions"]);
  async function visit(relative) {
    let entries;
    try {
      entries = await fs.readdir(safePath(root, relative), { withFileTypes: true });
    } catch (e) {
      if (e.code === "ENOENT") return;
      throw e;
    }
    for (const entry of entries) {
      if (excluded.has(entry.name)) continue;
      const file = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`检查范围不能包含符号链接：${file}`);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  const roots = ["prototype/src", "prototype/public"];
  const core = [
    "package.json",
    "pnpm-lock.yaml",
    "project.config.json",
    "project-status.json",
    "prototype/package.json",
    "prototype/vite.config.mjs",
    "prototype/index.html",
  ];
  let config = {};
  try {
    config = JSON.parse(await fs.readFile(safePath(root, "project.config.json"), "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (config.instanceKind === "kit") roots.push("scripts", "skills", "templates", "examples");
  else roots.push(".prototype-kit");
  for (const directory of roots) await visit(directory);
  for (const file of [
    ...core,
    ...Object.entries(config.paths || {})
      .filter(
        ([key, value]) =>
          !["requirementsSummary", "pageGuides", "developmentTaskList"].includes(key) &&
          typeof value === "string" &&
          /\.(json|md)$/.test(value),
      )
      .map(([, value]) => value),
  ]) {
    try {
      if ((await fs.stat(safePath(root, file))).isFile()) files.push(file);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  const snapshot = await fingerprintSources(files, { root });
  return {
    ...snapshot,
    nodeVersion: process.version,
    checkerVersion: createHash("sha256")
      .update(await fs.readFile(new URL(import.meta.url)))
      .digest("hex"),
  };
}
export async function evaluateCheckReport(report, { root }) {
  if (
    report?.schemaVersion !== 2 ||
    report.origin !== "process-exit" ||
    !report.runs?.length ||
    !report.coveredFiles?.length
  )
    return { valid: false, reason: "报告未运行或覆盖为空", freshness: "unknown" };
  const current = await captureInputs(root);
  const fresh =
    current.sourceFingerprint === report.sourceFingerprint &&
    current.nodeVersion === report.nodeVersion &&
    current.checkerVersion === report.checkerVersion;
  const passed =
    report.coverage === "complete" &&
    JSON.stringify(current.coveredFiles) === JSON.stringify(report.coveredFiles) &&
    report.result === "passed" &&
    report.runs.every((r) => r.exitCode === 0 && !r.timedOut && typeof r.command === "string") &&
    Number.isFinite(Date.parse(report.executedAt));
  return {
    valid: fresh && passed,
    freshness: fresh ? "fresh" : "stale",
    reason: !fresh
      ? "输入文件集合、内容或执行环境已变化"
      : passed
        ? "实际检查通过且覆盖完整"
        : "检查未通过",
  };
}
export async function runChecks({ root, target, commands, cache = false }) {
  if (!commands?.length) throw new Error("没有适用检查，不能生成通过报告");
  const before = await captureInputs(root);
  if (!before.coveredFiles.length) throw new Error("覆盖为空，不能执行交付检查");
  const key = digest({ inputs: before, commands, target });
  const reportPath = safePath(root, `dist/checks/${key}.json`);
  if (cache) {
    try {
      const previous = JSON.parse(await fs.readFile(reportPath, "utf8"));
      if ((await evaluateCheckReport(previous, { root })).valid)
        return { ...previous, cacheHit: true };
    } catch (e) {
      if (e.code !== "ENOENT" && !(e instanceof SyntaxError)) throw e;
    }
  }
  const runs = [];
  for (const spec of commands) {
    const started = Date.now();
    let exitCode = 0,
      timedOut = false;
    try {
      await exec(spec.command, spec.args || [], {
        cwd: root,
        env: { ...process.env, KIT_CHECK_RUNNING: "1" },
        timeout: spec.timeoutMs || 120000,
        maxBuffer: 4 * 1024 * 1024,
      });
    } catch (e) {
      exitCode = Number.isInteger(e.code) ? e.code : 1;
      timedOut = !!e.killed;
    }
    runs.push({
      command: spec.command,
      args: spec.args || [],
      exitCode,
      timedOut,
      durationMs: Date.now() - started,
    });
  }
  const after = await captureInputs(root);
  const stable = before.sourceFingerprint === after.sourceFingerprint;
  const report = {
    schemaVersion: 2,
    origin: "process-exit",
    target,
    executedAt: new Date().toISOString(),
    result: stable && runs.every((r) => r.exitCode === 0) ? "passed" : "failed",
    runs,
    ...before,
    coverage: stable ? "complete" : "changed-during-run",
    cacheKey: key,
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  return report;
}
export async function scopeCommand(root, args = []) {
  const opts = parseOptions(args, { values: ["cr"], flags: ["no-cache"] });
  const config = JSON.parse(await fs.readFile(safePath(root, "project.config.json"), "utf8"));
  if (opts.cr) {
    const registry = JSON.parse(
      await fs.readFile(safePath(root, config.paths.requirements), "utf8"),
    );
    if (!registry.items?.some((i) => i.id === opts.cr)) throw new Error(`未找到需求：${opts.cr}`);
  }
  // Until a complete dependency graph is declared, scope checks deliberately fall back to full checks.
  const commands =
    config.instanceKind === "kit"
      ? [
          { command: "pnpm", args: ["check"] },
          { command: "pnpm", args: ["--dir", "prototype", "build"] },
        ]
      : [
          { command: process.execPath, args: [".prototype-kit/business-cli.mjs", "check"] },
          { command: "pnpm", args: ["--dir", "prototype", "build"] },
        ];
  const report = await runChecks({
    root,
    target: opts.cr || "full",
    commands,
    cache: !opts["no-cache"],
  });
  const valid = (await evaluateCheckReport(report, { root })).valid;
  const output = {
    已验证: report.runs
      .filter((r) => r.exitCode === 0)
      .map((r) => [r.command, ...r.args].join(" ")),
    未验证: ["产品业务结论与人工最终评审"],
    阻断项: valid ? [] : [issue("CHECK_FAILED", "runs", "检查失败或输入变化", "修复后重新检查")],
    需谁确认: "产品经理",
    下一动作: valid ? "核对验收事实；不自动完成需求" : "处理阻断项",
    范围: "影响关系未完整声明，已回退全量检查",
    report,
  };
  console.log(JSON.stringify(output, null, 2));
  if (!valid) process.exitCode = 1;
  return report;
}
