import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep the existing acceptance test unchanged: a mutant counts as detected only
// when that test raises an assertion, never when code fails to parse or import.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const oracle = "scripts/test-check-runner.mjs";
const implementation = "scripts/check-runner.mjs";
const copiedFiles = [
  "package.json",
  implementation,
  oracle,
  "scripts/source-fingerprint.mjs",
  "scripts/safe-path.mjs",
  "scripts/cli-lib.mjs",
  "scripts/project-lib.mjs",
];
const mutations = [
  {
    id: "governance",
    rule: "治理规则变化后旧证据失效",
    mistake: "从覆盖清单遗漏 AGENTS.md",
    before: '    "AGENTS.md",\n',
    after: "",
  },
  {
    id: "snapshot",
    rule: "采用的文档快照变化后旧证据失效",
    mistake: "跳过文档基线的快照收集",
    before: "  const documentEvidence = await documentEvidenceFiles(root, config);",
    after: "  const documentEvidence = [];",
  },
  {
    id: "stale",
    rule: "输入已变化的报告不能支撑就绪",
    mistake: "把过期报告判为有效",
    before: '  if (!fresh)\n    return {\n      valid: false,\n      status: "stale",',
    after: '  if (!fresh)\n    return {\n      valid: true,\n      status: "valid",',
  },
  {
    id: "failed",
    rule: "命令执行失败的报告不能支撑就绪",
    mistake: "忽略报告结果和命令退出码",
    before: `  const passed =
    report.result === "passed" &&
    report.runs.every((r) => r.exitCode === 0 && !r.timedOut && typeof r.command === "string") &&
    Number.isFinite(Date.parse(report.executedAt));`,
    after: "  const passed = true;",
  },
  {
    id: "legacy-passed",
    rule: "手填旧式 passed 不能替代实际执行证据",
    mistake: "把不支持的旧式报告判为有效",
    before: '      valid: false,\n      status: "unsupported",',
    after: '      valid: true,\n      status: "valid",',
  },
];

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "kit-evidence-mutations-"));
try {
  const sources = new Map(
    await Promise.all(copiedFiles.map(async (file) => [file, await fs.readFile(path.join(root, file))])),
  );
  const source = sources.get(implementation).toString("utf8");
  async function prepare(name, contents = source) {
    const isolated = path.join(temp, name);
    for (const [file, bytes] of sources) {
      const target = path.join(isolated, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file === implementation ? contents : bytes);
    }
    return isolated;
  }
  function runOracle(isolated) {
    // Do not inherit credential-bearing environment variables into the sandbox.
    const env = {};
    for (const key of ["PATH", "SYSTEMROOT", "WINDIR", "TMPDIR", "TMP", "TEMP"])
      if (process.env[key]) env[key] = process.env[key];
    return execFileSync(process.execPath, [oracle], {
      cwd: isolated,
      env,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      stdio: "pipe",
    });
  }

  // An independently passing baseline prevents pre-existing test failures from
  // being mistaken for useful detection of an intentionally broken behavior.
  runOracle(await prepare("baseline"));
  console.log(`证据可信规则：未修改基准通过（${oracle}）。`);
  for (const mutation of mutations) {
    assert.equal(
      source.split(mutation.before).length - 1,
      1,
      `${mutation.id} 补丁必须唯一命中；源码变化后需重新评审错误实现`,
    );
    const isolated = await prepare(mutation.id, source.replace(mutation.before, mutation.after));
    let failure;
    try {
      runOracle(isolated);
    } catch (error) {
      failure = error;
    }
    assert.ok(failure, `${mutation.id} 未被原有验收测试检测到`);
    assert.equal(failure.signal, null, `${mutation.id} 不能依赖超时或进程终止`);
    assert.equal(failure.status, 1, `${mutation.id} 必须是正常运行后的断言失败`);
    const output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
    assert.match(output, /AssertionError \[ERR_ASSERTION\]/, `${mutation.id} 必须被业务断言捕获`);
    assert.match(output, /test-check-runner\.mjs:\d+:\d+/, `${mutation.id} 必须命中原有验收测试`);
    assert.doesNotMatch(output, /SyntaxError|ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION/);
    console.log(`${mutation.rule} → ${mutation.mistake} → ${oracle}：已检测（AssertionError）。`);
  }
  console.log("错误实现验收：基准通过，5 个隔离错误均被原有断言检测；结果不代替产品确认。");
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
