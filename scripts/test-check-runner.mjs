import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runChecks, evaluateCheckReport } from "./check-runner.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-checks-"));
try {
  await fs.mkdir(path.join(root, "prototype/src"), { recursive: true });
  await fs.writeFile(path.join(root, "prototype/src/a.js"), "source");
  await fs.writeFile(path.join(root, "project.config.json"), "{}");
  const command = { command: process.execPath, args: ["-e", "process.exit(0)"] };
  const report = await runChecks({ root, target: "test", commands: [command] });
  assert.equal((await evaluateCheckReport(report, { root })).valid, true);
  assert.ok(report.coveredFiles.some((file) => file.path === "AGENTS.md"));
  const cached = await runChecks({ root, target: "test", commands: [command], cache: true });
  assert.equal(cached.cacheHit, true);
  const incomplete = { ...report, coverage: "partial" };
  assert.equal((await evaluateCheckReport(incomplete, { root })).status, "incomplete");
  const beforeGovernanceChange = await runChecks({ root, target: "test", commands: [command] });
  await fs.writeFile(path.join(root, "AGENTS.md"), "updated governance\n");
  assert.equal((await evaluateCheckReport(beforeGovernanceChange, { root })).status, "stale");
  for (const [file, content] of [
    ["README.md", "updated current instructions"],
    ["START-HERE.md", "updated current entry"],
    ["prototype/src/a.js", "changed"],
    ["project.config.json", '{"name":"changed"}'],
    ["pnpm-lock.yaml", "lock"],
    [".prototype-kit/check-runner.mjs", "checker"],
  ]) {
    const baseline = await runChecks({ root, target: "test", commands: [command] });
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
    assert.equal((await evaluateCheckReport(baseline, { root })).valid, false, file);
  }
  const beforeDelete = await runChecks({ root, target: "test", commands: [command] });
  await fs.rm(path.join(root, "prototype/src/a.js"));
  assert.equal((await evaluateCheckReport(beforeDelete, { root })).valid, false);
  await fs.writeFile(path.join(root, "prototype/src/new.js"), "new");
  assert.equal((await evaluateCheckReport(report, { root })).valid, false);
  const failed = await runChecks({
    root,
    target: "test",
    commands: [{ ...command, args: ["-e", "process.exit(2)"] }],
  });
  assert.equal((await evaluateCheckReport(failed, { root })).valid, false);
  assert.equal(
    (await evaluateCheckReport({ result: "passed", coveredFiles: [] }, { root })).valid,
    false,
  );
  await fs.mkdir(path.join(root, "docs/review/snapshots"), { recursive: true });
  await fs.writeFile(path.join(root, "docs/review/snapshots/requirements.md"), "snapshot v1\n");
  await fs.writeFile(
    path.join(root, "docs/review/document-baseline.json"),
    JSON.stringify({
      schemaVersion: 1,
      documents: [
        {
          id: "requirements",
          locator: "https://example.invalid/document",
          snapshotPath: "docs/review/snapshots/requirements.md",
        },
      ],
    }),
  );
  await fs.writeFile(
    path.join(root, "project.config.json"),
    JSON.stringify({ paths: { documentBaseline: "docs/review/document-baseline.json" } }),
  );
  const documentReport = await runChecks({ root, target: "test", commands: [command] });
  for (const expected of [
    "docs/review/document-baseline.json",
    "docs/review/snapshots/requirements.md",
  ])
    assert.ok(documentReport.coveredFiles.some((file) => file.path === expected), expected);
  assert.equal(
    documentReport.coveredFiles.some((file) => file.path.startsWith("https:")),
    false,
  );
  await fs.writeFile(path.join(root, "docs/review/snapshots/requirements.md"), "snapshot v2\n");
  assert.equal((await evaluateCheckReport(documentReport, { root })).status, "stale");
  console.log("检查执行器：真实退出码、治理规则、文档基线、失败和覆盖失效通过。");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
