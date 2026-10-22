import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCheckReport, evaluateFreshness } from "./source-fingerprint.mjs";
import { runChecks } from "./check-runner.mjs";
import { evaluateReviewReport, renderReviewPackage } from "./review-package.mjs";

const root = await fs.mkdtemp(path.join(tmpdir(), "prototype-kit-evidence-"));
try {
  await fs.mkdir(path.join(root, "prototype/src"), { recursive: true });
  await fs.writeFile(path.join(root, "prototype/src/app.js"), "export const app = true;\n");
  await fs.writeFile(path.join(root, "project.config.json"), "{}\n");
  await fs.writeFile(path.join(root, "AGENTS.md"), "fixture governance\n");
  await fs.writeFile(path.join(root, "source.js"), "export const value = 1;\n", "utf8");
  const legacyReport = await createCheckReport({
    id: "anonymous-check",
    command: "node test.js",
    files: ["source.js"],
    result: "passed",
    executedAt: "2099-01-01T00:00:00.000Z",
    root,
  });
  assert.equal((await evaluateFreshness(legacyReport, { root })).status, "fresh");
  await fs.writeFile(path.join(root, "source.js"), "export const value = 2;\n", "utf8");
  assert.equal((await evaluateFreshness(legacyReport, { root })).status, "stale");
  await fs.rm(path.join(root, "source.js"));
  assert.equal((await evaluateFreshness(legacyReport, { root })).status, "missing");

  const sample = JSON.parse(await fs.readFile(new URL("../examples/review-workflow-isolated.json", import.meta.url), "utf8"));
  const command = { command: process.execPath, args: ["-e", "process.exit(0)"] };
  const actualReport = await runChecks({ root, target: "CR-900", commands: [command] });
  await fs.mkdir(path.join(root, "dist/checks"), { recursive: true });
  await fs.writeFile(
    path.join(root, "dist/checks/actual.json"),
    `${JSON.stringify(actualReport, null, 2)}\n`,
  );
  const actualEvaluation = await evaluateReviewReport("dist/checks/actual.json", { root });
  assert.equal(actualEvaluation.valid, true);
  assert.equal((await evaluateReviewReport("dist/checks/actual.json", { root, target: "CR-OTHER" })).status, "incomplete");
  const first = renderReviewPackage(sample, { checkReportEvaluation: actualEvaluation });
  const second = renderReviewPackage(sample, { checkReportEvaluation: actualEvaluation });
  assert.equal(first, second, "相同输入连续生成的评审包应一致");
  assert.match(first, /不成为新的业务事实源/);
  assert.match(first, /当前唯一卡点/);
  assert.match(first, /检查证据可供评审，仍需产品确认/);
  assert.equal(first.includes("real-project."), false, "匿名样本不得包含宿主项目标识");

  const linked = renderReviewPackage(sample, {
    checkReportEvaluation: actualEvaluation,
    outputPath: "dist/review-packages/CR-900.md",
  });
  assert.ok(linked.includes("[dist/checks/actual.json](../checks/actual.json)"), "报告链接须从评审包所在目录可访问");
  assert.ok(linked.includes("../../examples/review-decision-isolated.md#sample-decision"));
  assert.ok(linked.includes(sample.evidence[0].originalClaim), "须保留已登记的 mock 替换偏差");
  assert.ok(linked.includes(sample.evidence[0].aiInterpretation));
  assert.match(linked, /AI 解读（不能替代验证）/);
  assert.match(linked, /确认记录：candidate；确认方待核对/);
  assert.ok(linked.includes(actualReport.executedAt));
  assert.match(linked, /退出码：0/);
  assert.match(linked, /未在当前报告覆盖，待核对/);

  const multiple = structuredClone(sample);
  multiple.acceptanceCriteria.push({ id: "AC-UNSUPPORTED", text: "另一条验收" });
  multiple.evidence.push({ ...sample.evidence[0], location: "sample:unrelated", originalClaim: "UNRELATED_DECISION" });
  const mapped = renderReviewPackage(multiple, { checkReportEvaluation: actualEvaluation });
  const unsupported = mapped.slice(mapped.indexOf("**AC-UNSUPPORTED"), mapped.indexOf("### 关键自主决策"));
  assert.match(unsupported, /未登记支撑产物/);
  assert.equal(unsupported.includes("sample:prototype"), false, "不把其他验收的产物挪用给无证据的验收");
  assert.equal(mapped.includes("UNRELATED_DECISION"), false, "只展开本任务 decision 产物直接引用的记录");

  const noDecision = { ...sample, artifacts: sample.artifacts.filter((a) => a.type !== "decision") };
  assert.match(renderReviewPackage(noDecision), /不能据此认定没有偏离/);
  assert.match(renderReviewPackage({ ...sample, evidence: [] }), /只有决策引用/);
  const covered = structuredClone(sample);
  covered.artifacts.find((a) => a.type === "decision").location = "prototype/src/app.js";
  covered.evidence[0].location = "prototype/src/app.js";
  assert.match(renderReviewPackage(covered, { checkReportEvaluation: actualEvaluation }), /文件纳入当前检查覆盖，业务含义仍需核对/);

  const missingEvaluation = await evaluateReviewReport("dist/checks/missing.json", { root });
  assert.equal(missingEvaluation.status, "missing");
  assert.match(renderReviewPackage(sample, { checkReportEvaluation: missingEvaluation }), /缺失/);
  assert.equal(missingEvaluation.reportPath, "dist/checks/missing.json");

  for (const bad of [null, { schemaVersion: 1, origin: "manual", runs: [null] },
    { schemaVersion: 2, origin: "process-exit", runs: [null] }]) {
    await fs.writeFile(path.join(root, "dist/checks/malformed.json"), JSON.stringify(bad));
    const badEvaluation = await evaluateReviewReport("dist/checks/malformed.json", { root });
    assert.equal(badEvaluation.valid, false);
    assert.doesNotThrow(() => renderReviewPackage(sample, { checkReportEvaluation: badEvaluation }));
    assert.equal(renderReviewPackage(sample, { checkReportEvaluation: badEvaluation }).includes("检查命令："), false);
  }
  const historical = renderReviewPackage({ ...sample, acceptanceCriteria: ["旧式验收原文"] });
  assert.match(historical, /历史验收未结构化，未按新规则验证：旧式验收原文/);
  assert.equal(historical.includes("undefined：undefined"), false);

  await fs.writeFile(
    path.join(root, "dist/checks/legacy.json"),
    `${JSON.stringify(legacyReport, null, 2)}\n`,
  );
  assert.equal(
    (await evaluateReviewReport("dist/checks/legacy.json", { root })).status,
    "unsupported",
  );
  await fs.writeFile(
    path.join(root, "dist/checks/manual.json"),
    `${JSON.stringify({ schemaVersion: 2, origin: "manual", result: "passed" }, null, 2)}\n`,
  );
  const manualEvaluation = await evaluateReviewReport("dist/checks/manual.json", { root });
  assert.equal(manualEvaluation.status, "unsupported");
  assert.equal(
    renderReviewPackage(sample, { checkReportEvaluation: manualEvaluation }).includes("已就绪"),
    false,
  );

  await fs.writeFile(
    path.join(root, "dist/checks/partial.json"),
    `${JSON.stringify({ ...actualReport, coverage: "partial" }, null, 2)}\n`,
  );
  assert.equal(
    (await evaluateReviewReport("dist/checks/partial.json", { root })).status,
    "incomplete",
  );
  await fs.writeFile(
    path.join(root, "dist/checks/failed.json"),
    `${JSON.stringify({
      ...actualReport,
      result: "failed",
      runs: actualReport.runs.map((run) => ({ ...run, exitCode: 1 })),
    }, null, 2)}\n`,
  );
  assert.equal(
    (await evaluateReviewReport("dist/checks/failed.json", { root })).status,
    "failed",
  );
  await fs.writeFile(path.join(root, "prototype/src/app.js"), "export const app = false;\n");
  assert.equal(
    (await evaluateReviewReport("dist/checks/actual.json", { root })).status,
    "stale",
  );
  const staleEvaluation = await evaluateReviewReport("dist/checks/actual.json", { root });
  const staleCard = renderReviewPackage(covered, { checkReportEvaluation: staleEvaluation });
  assert.match(staleCard, /当前报告不能核验，待核对/);
  assert.equal(staleCard.includes("文件纳入当前检查覆盖"), false, "过期报告不得给产物标记当前覆盖");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("旧指纹兼容、Schema 2 实际报告与确定性 Markdown 评审包测试通过。");
