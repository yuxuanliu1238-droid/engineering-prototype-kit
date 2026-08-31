import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCheckReport, evaluateFreshness } from "./source-fingerprint.mjs";
import { renderReviewPackage } from "./review-package.mjs";

const root = await fs.mkdtemp(path.join(tmpdir(), "prototype-kit-evidence-"));
try {
  await fs.writeFile(path.join(root, "source.js"), "export const value = 1;\n", "utf8");
  const report = await createCheckReport({
    id: "anonymous-check",
    command: "node test.js",
    files: ["source.js"],
    result: "passed",
    executedAt: "2099-01-01T00:00:00.000Z",
    root,
  });
  assert.equal((await evaluateFreshness(report, { root })).status, "fresh");
  await fs.writeFile(path.join(root, "source.js"), "export const value = 2;\n", "utf8");
  assert.equal((await evaluateFreshness(report, { root })).status, "stale");
  await fs.rm(path.join(root, "source.js"));
  assert.equal((await evaluateFreshness(report, { root })).status, "missing");

  const sample = JSON.parse(await fs.readFile(new URL("../examples/review-workflow-isolated.json", import.meta.url), "utf8"));
  const first = renderReviewPackage(sample, { freshness: { status: "fresh", reason: "匿名样本一致" } });
  const second = renderReviewPackage(sample, { freshness: { status: "fresh", reason: "匿名样本一致" } });
  assert.equal(first, second, "相同输入连续生成的评审包应一致");
  assert.match(first, /不成为新的业务事实源/);
  assert.match(first, /当前唯一卡点/);
  assert.equal(first.includes("real-project."), false, "匿名样本不得包含宿主项目标识");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("匿名证据新鲜度与确定性 Markdown 评审包测试通过。");
