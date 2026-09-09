import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTaskContext, verifyTaskContext } from "./task-context.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-context-"));
try {
  await fs.mkdir(path.join(root, "src"));
  await fs.writeFile(path.join(root, "src/a.js"), "export const value=1;");
  const config = { paths: { requirements: "registry.json" } };
  await fs.writeFile(path.join(root, "project.config.json"), JSON.stringify(config));
  await fs.writeFile(
    path.join(root, "project-status.json"),
    JSON.stringify({ currentMode: "continuous-iteration" }),
  );
  const items = Array.from({ length: 60 }, (_, i) => ({
    id: `CR-${String(i + 1).padStart(3, "0")}`,
    summary: "synthetic task",
    originalRequest: "material ".repeat(100),
    executionState: "locked",
    aiPolicy: "unassessed",
    executionScope: { objective: "target", included: ["a"], excluded: ["DO_NOT_IMPLEMENT"] },
    acceptanceCriteria: [{ id: "AC-1", text: "check" }],
    documents: ["src/a.js"],
    openQuestions: ["QUESTION"],
  }));
  await fs.writeFile(path.join(root, "registry.json"), JSON.stringify({ items }));
  await fs.writeFile(path.join(root, "src/shared.js"), "export const shared = 1;");
  await fs.writeFile(
    path.join(root, "src/a.js"),
    "import {shared} from './shared.js'; export const value=shared;",
  );
  const cases = [
    ["局部文案", "CR-001"],
    ["单页交互", "CR-002"],
    ["共享规则", "CR-003"],
    ["修改复盘", "CR-004"],
  ];
  items[0].executionScope.objective = "调整局部文案";
  items[1].executionScope.objective = "验证抽屉取消";
  items[1].acceptanceCriteria.push({ id: "AC-2", text: "取消不改变数据" });
  items[2].executionScope.objective = "修改共享规则";
  items[2].documents.push("src/shared.js");
  items[3].executionScope.objective = "复盘当前改动";
  items[3].evidence = [{ id: "EV-1", location: "src/shared.js" }];
  await fs.writeFile(path.join(root, "registry.json"), JSON.stringify({ items }));
  const report = [];
  for (const [name, cr] of cases) {
    const pack = await createTaskContext({ root, cr });
    assert.equal(pack.allowedAction, "read-only");
    assert.ok(JSON.stringify(pack).includes("DO_NOT_IMPLEMENT"));
    assert.ok(JSON.stringify(pack).includes("QUESTION"));
    assert.ok(!JSON.stringify(pack).includes("CR-060"));
    assert.ok(pack.coveredFiles.some((f) => f.path === "src/shared.js"));
    const before = Buffer.byteLength(JSON.stringify({ items }));
    const after = Buffer.byteLength(JSON.stringify(pack));
    assert.ok(after < before * 0.7);
    report.push({ name, before, after, reduction: 1 - after / before });
    assert.equal((await verifyTaskContext(pack, { root })).status, "fresh");
  }
  const handoff = JSON.parse(
    await fs.readFile(
      new URL("../examples/development-handoff-isolated.json", import.meta.url),
      "utf8",
    ),
  );
  await fs.writeFile(path.join(root, "handoff.json"), JSON.stringify(handoff));
  config.paths.developmentHandoff = "handoff.json";
  await fs.writeFile(path.join(root, "project.config.json"), JSON.stringify(config));
  await fs.writeFile(
    path.join(root, "project-status.json"),
    JSON.stringify({
      currentMode: "continuous-iteration",
      capabilities: { developmentHandoff: { enabled: true } },
    }),
  );
  const taskPack = await createTaskContext({ root, task: "TASK-002" });
  assert.ok(!JSON.stringify(taskPack).includes("TASK-003"));
  assert.equal(taskPack.allowedAction, "read-only");
  const before = Buffer.byteLength(JSON.stringify(handoff));
  const after = Buffer.byteLength(JSON.stringify(taskPack));
  report.push({ name: "单任务交接", before, after, reduction: 1 - after / before });
  assert.ok(report.filter((r) => r.reduction >= 0.3).length >= 4);
  const small = await createTaskContext({ root, cr: "CR-001", budget: 100 });
  assert.ok(small.budgetExceeded);
  assert.ok(small.scope.excluded.includes("DO_NOT_IMPLEMENT"));
  console.log(JSON.stringify({ syntheticBenchmark: report }));
  const pack = await createTaskContext({ root, cr: "CR-001" });
  await fs.writeFile(path.join(root, "src/a.js"), "changed");
  assert.equal((await verifyTaskContext(pack, { root })).status, "stale");
  const tampered = { ...pack, nextAction: "do something else" };
  assert.equal((await verifyTaskContext(tampered, { root })).status, "stale");
  config.paths.reviewScenarios = "scenarios.json";
  await fs.writeFile(path.join(root, "project.config.json"), JSON.stringify(config));
  await fs.writeFile(
    path.join(root, "project-status.json"),
    JSON.stringify({ currentMode: "rapid-validation" }),
  );
  await fs.writeFile(
    path.join(root, "scenarios.json"),
    JSON.stringify({
      scenarios: [
        {
          id: "SCENE-1",
          title: "quick",
          goal: "verify",
          expectedResult: "visible",
          preconditions: ["demo data"],
        },
      ],
    }),
  );
  const rapid = await createTaskContext({ root, scenario: "SCENE-1" });
  assert.equal(rapid.kind, "scenario");
  assert.ok(!rapid.coveredFiles.some((f) => f.path === "registry.json"));
  await assert.rejects(createTaskContext({ root, cr: "CR-001" }), /快速验证/);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
