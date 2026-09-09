import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import {
  analyzeHandoffCoverage,
  renderDevelopmentTaskList,
  validateDevelopmentHandoff,
} from "./development-handoff-lib.mjs";

const sample = JSON.parse(
  await fs.readFile(new URL("../examples/development-handoff-isolated.json", import.meta.url), "utf8"),
);

function clone(value) {
  return structuredClone(value);
}

function errorsFor(value) {
  return validateDevelopmentHandoff(value).join("\n");
}

assert.equal(errorsFor(sample), "", "匿名正式研发任务清单应通过校验");
assert.deepEqual(
  analyzeHandoffCoverage(sample).map((check) => check.status),
  ["passed", "passed", "passed", "passed"],
  "匿名正式清单应通过四项覆盖检查",
);

const first = renderDevelopmentTaskList(sample);
const second = renderDevelopmentTaskList(sample);
assert.equal(first, second, "相同结构化任务清单必须确定性生成相同 Markdown");
for (const heading of ["应用功能任务", "外部系统接口任务", "非页面研发任务", "完整性检查"]) {
  assert.match(first, new RegExp(heading), `生成视图缺少：${heading}`);
}
assert.match(first, /钉钉文档/);
assert.match(first, /prototype:\/app\/orders/);
assert.match(first, /当前状态 \| 正式版/);
assert.match(first, /REQ-004 \| 信用额度配置 \| 无需研发改动/);
assert.match(first, /TASK-010[\s\S]*研发确认的技术必要项/);
assert.equal(first.includes("任务负责人"), false, "任务清单不得包含任务负责人字段");
assert.equal(first.includes("完成比例"), true, "清单边界说明应明确不管理完成比例");

const shuffled = clone(sample);
shuffled.tasks.reverse();
const shuffledView = renderDevelopmentTaskList(shuffled);
assert.equal(shuffledView, first, "任务输入顺序变化后，三张表仍应按分类稳定排序");

const missingRequirement = clone(sample);
missingRequirement.handoffScope.requirements.push({
  id: "REQ-099",
  title: "遗漏需求",
  disposition: "development-required",
  reason: null,
  materialRefIds: ["MAT-REQ"],
});
assert.match(errorsFor(missingRequirement), /未通过需求覆盖.*REQ-099/);
missingRequirement.status = "draft";
assert.equal(errorsFor(missingRequirement), "", "草稿允许保留覆盖缺口供研发评审");
assert.equal(analyzeHandoffCoverage(missingRequirement)[0].status, "failed");

const noDevelopment = clone(sample);
noDevelopment.handoffScope.requirements.push({
  id: "REQ-098",
  title: "本次无需研发改动",
  disposition: "no-development",
  reason: "研发评审确认沿用现有能力",
  materialRefIds: ["MAT-REVIEW"],
});
assert.equal(errorsFor(noDevelopment), "", "明确无需研发改动的需求不应强制关联任务");

const missingProductConfirmation = clone(sample);
missingProductConfirmation.confirmations.product.decision = "pending";
missingProductConfirmation.confirmations.product.confirmedBy = null;
missingProductConfirmation.confirmations.product.confirmedAt = null;
assert.match(errorsFor(missingProductConfirmation), /必须由产品经理确认/);

const missingEngineeringConfirmation = clone(sample);
missingEngineeringConfirmation.confirmations.engineering.decision = "pending";
missingEngineeringConfirmation.confirmations.engineering.confirmedBy = null;
missingEngineeringConfirmation.confirmations.engineering.confirmedAt = null;
assert.match(errorsFor(missingEngineeringConfirmation), /必须由研发负责人确认/);

const businessQuestion = clone(sample);
businessQuestion.businessOpenQuestions = [{
  question: "库存不足时是否允许继续审核？",
  requestedFrom: "产品负责人",
  impact: "会改变审核结果",
  resumeWhen: "产品负责人确认规则",
}];
assert.match(errorsFor(businessQuestion), /待确认问题.*不得正式化/);

const implementationPrerequisite = clone(sample);
implementationPrerequisite.implementationPrerequisites.push({
  item: "测试环境地址",
  owner: "研发团队",
  impact: "未满足前不能联调",
  readyWhen: "研发提供匿名测试环境",
});
assert.equal(errorsFor(implementationPrerequisite), "", "实施前置条件不应阻止开发范围正式化");

const progressPollution = clone(sample);
progressPollution.tasks[0].progress = 50;
assert.match(errorsFor(progressPollution), /不属于开发范围清单/);

const excludedRequirementTask = clone(sample);
excludedRequirementTask.tasks[0].requirementIds.push("REQ-004");
assert.match(errorsFor(excludedRequirementTask), /不得引用已标记无需研发改动的需求/);

const excludedApplicationTask = clone(sample);
excludedApplicationTask.tasks[0].scopeItemIds.push("APP-SCOPE-004");
assert.match(errorsFor(excludedApplicationTask), /不得引用已标记本次不改的应用触点/);

const mixedTaskShape = clone(sample);
mixedTaskShape.tasks[0].integration = {
  systemParty: "不应出现的系统",
  interfaceName: "不应出现的接口",
  direction: "counterparty-provides-we-call",
  triggerScenario: "不应出现",
};
assert.match(errorsFor(mixedTaskShape), /不得混入其他类型结构/);

const invalidStructure = clone(sample);
invalidStructure.tasks[0] = null;
assert.doesNotThrow(() => validateDevelopmentHandoff(invalidStructure));
assert.match(errorsFor(invalidStructure), /tasks\[0\] 必须是对象/);

const changedMaterial = clone(sample);
changedMaterial.materials[0].baselineState = "changed";
assert.match(errorsFor(changedMaterial), /尚未形成可用评审基线/);

const untraceable = clone(sample);
untraceable.tasks[9].technicalBasis = null;
assert.match(errorsFor(untraceable), /必须关联需求.*technicalBasis/);
assert.match(errorsFor(untraceable), /未通过任务反查.*TASK-010/);

const omission = clone(sample);
omission.version = "V1.1";
omission.currentRevision = {
  changeType: "in-scope-omission",
  summary: "补充原范围内遗漏的链路日志任务",
  businessScopeChanged: false,
  relatedCrIds: [],
};
omission.versionHistory.push({
  version: "V1.1",
  changeType: "in-scope-omission",
  summary: "补充原范围内遗漏的链路日志任务",
  recordedAt: "2099-01-03",
});
omission.confirmations.product.decision = "acknowledged";
assert.equal(errorsFor(omission), "", "原范围遗漏版本允许产品知悉、研发确认");

const scopeChange = clone(sample);
scopeChange.version = "V2.0";
scopeChange.currentRevision = {
  changeType: "business-scope-change",
  summary: "新增会改变业务结果的规则",
  businessScopeChanged: true,
  relatedCrIds: [],
};
scopeChange.versionHistory.push({
  version: "V2.0",
  changeType: "business-scope-change",
  summary: "新增会改变业务结果的规则",
  recordedAt: "2099-01-03",
});
assert.match(errorsFor(scopeChange), /必须关联重新评审的 CR/);

const secret = clone(sample);
secret.materials[0].locator = ["https://example.invalid/doc?", "token", "=", "this-is-a-secret-value"].join("");
assert.match(errorsFor(secret), /疑似包含密钥/);

const expectedMarkdown = await fs.readFile(
  new URL("../examples/development-handoff-isolated.md", import.meta.url),
  "utf8",
);
assert.equal(expectedMarkdown, first, "匿名 Markdown 示例必须与结构化样本同源");

console.log("研发任务清单测试通过：三类任务、双确认、四项覆盖、版本规则和材料边界均有效。");
