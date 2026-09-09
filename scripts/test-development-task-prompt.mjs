import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import {
  renderDevelopmentTaskPrompt,
  validateTaskPromptContext,
} from "./development-task-prompt-lib.mjs";

const handoff = JSON.parse(
  await fs.readFile(new URL("../examples/development-handoff-isolated.json", import.meta.url), "utf8"),
);
const context = JSON.parse(
  await fs.readFile(new URL("../examples/development-task-context-isolated.json", import.meta.url), "utf8"),
);

function clone(value) {
  return structuredClone(value);
}

function errorsFor(source = handoff, taskId = "TASK-002", taskContext = context) {
  return validateTaskPromptContext(source, taskId, taskContext).join("\n");
}

assert.equal(errorsFor(), "", "匿名单任务上下文应通过校验");

const first = renderDevelopmentTaskPrompt(handoff, "TASK-002", context);
const second = renderDevelopmentTaskPrompt(handoff, "TASK-002", context);
assert.equal(first, second, "同一任务和材料上下文必须确定性生成相同提示词");
assert.match(first, /生成本提示词不构成实施授权/);
assert.match(first, /只能读取、核对并报告就绪情况/);
assert.match(first, /待审核订单允许打开审核弹窗/);
assert.match(first, /原型入口：运营后台／订单管理／订单列表／审核/);
assert.match(first, /截图：订单审核弹窗/);
assert.match(first, /MAT-STOCK 版本未自动核对/);
assert.match(first, /只实施 TASK-002/);
assert.equal(first.includes("TASK-003"), false, "单任务提示词不得带入其他任务编号");
assert.equal(first.includes("订单发货操作"), false, "单任务提示词不得带入其他任务内容");
assert.equal(first.includes("上游匿名测试订单"), false, "单任务提示词不得带入未关联的项目级前置条件");

const draft = clone(handoff);
draft.status = "draft";
assert.match(errorsFor(draft), /只有正式研发任务清单/);

assert.match(errorsFor(handoff, "TASK-999", { ...context, taskId: "TASK-999" }), /任务不存在/);

const mismatched = clone(context);
mismatched.listVersion = "V0.9";
mismatched.taskId = "TASK-001";
assert.match(errorsFor(handoff, "TASK-002", mismatched), /listVersion.*不一致/);
assert.match(errorsFor(handoff, "TASK-002", mismatched), /taskId.*不一致/);

const missingMaterial = clone(context);
missingMaterial.materials.pop();
assert.match(errorsFor(handoff, "TASK-002", missingMaterial), /缺少材料上下文：MAT-STOCK/);

const revisionMismatch = clone(context);
revisionMismatch.materials[1].observedRevision = "prototype-demo-v2";
assert.match(errorsFor(handoff, "TASK-002", revisionMismatch), /当前版本与评审基线不一致/);

const matchedWithoutBaseline = clone(context);
matchedWithoutBaseline.materials[0].resolutionState = "matched";
matchedWithoutBaseline.materials[0].observedRevision = "untraceable-version";
assert.match(errorsFor(handoff, "TASK-002", matchedWithoutBaseline), /评审基线没有可自动比对版本/);

const extraMaterial = clone(context);
extraMaterial.materials.push({
  materialId: "MAT-SHIP",
  resolutionState: "matched",
  observedLocator: "不应读取的发货材料",
  observedRevision: "v1",
  excerpts: [],
  attachments: [],
});
assert.match(errorsFor(handoff, "TASK-002", extraMaterial), /不属于当前任务/);

for (const resolutionState of ["changed", "missing"]) {
  const blocked = clone(context);
  blocked.materials[3].resolutionState = resolutionState;
  blocked.materials[3].reason = `${resolutionState} test`;
  assert.match(errorsFor(handoff, "TASK-002", blocked), /停止生成提示词/);
}

const unverified = clone(context);
unverified.materials[0].resolutionState = "unverified";
unverified.materials[0].reason = "无法自动读取钉钉文档版本";
delete unverified.materials[0].confirmedBy;
delete unverified.materials[0].confirmedAt;
assert.equal(errorsFor(handoff, "TASK-002", unverified), "", "未自动核对材料应警告但允许生成提示词");
assert.match(renderDevelopmentTaskPrompt(handoff, "TASK-002", unverified), /无法自动读取钉钉文档版本/);

const secret = clone(context);
secret.materials[0].excerpts[0].content = ["sk", "-", "1234567890abcdefghij1234567890"].join("");
assert.match(errorsFor(handoff, "TASK-002", secret), /疑似包含密钥/);

const expected = await fs.readFile(
  new URL("../examples/development-task-prompt-isolated.md", import.meta.url),
  "utf8",
);
assert.equal(expected, first, "匿名提示词示例必须与结构化材料上下文同源");

console.log("单任务研发提示词测试通过：任务隔离、材料核对、阻断边界和授权分离均有效。");
