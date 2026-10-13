import assert from "node:assert/strict";
import {
  validateDeliveryGovernance,
  validateDeliveryGovernanceRefs,
} from "./delivery-governance-lib.mjs";

const valid = {
  schemaVersion: 1,
  capabilityCatalog: [
    {
      id: "cap-recalculate",
      label: "重新计算",
      pageRef: "page-detail",
      purpose: "business",
      requirementTreatment: "include",
      allowedStateRefs: ["state-failed"],
      visibilityRule: "仅在失败状态且根因已修复时出现",
    },
    {
      id: "cap-reset-demo",
      label: "恢复演示数据",
      pageRef: "page-review",
      purpose: "review-only",
      requirementTreatment: "exclude",
      allowedStateRefs: [],
      visibilityRule: "只在评审入口展示",
    },
  ],
  changeImpacts: [
    {
      id: "impact-time-source",
      decisionRef: "decision:time-source",
      reason: "统一判断时间来源",
      affected: {
        fields: ["field-requested-at"],
        rules: ["rule-month"],
        states: [],
        pages: ["page-detail"],
        fixtures: ["fixture-core"],
        documents: ["requirement-main"],
        integrations: [],
      },
      acceptanceScenarioRefs: ["scenario-core"],
    },
  ],
  b2bExperience: {
    navigationPattern: "host-convention",
    hostConventionEvidence: "现有系统使用面包屑进入列表和详情",
    checks: [
      { id: "ux-nav", area: "navigation", requirement: "遵循宿主系统层级", status: "pending", evidenceRefs: [] },
      { id: "ux-info", area: "information-hierarchy", requirement: "同一信息不重复展示", status: "pending", evidenceRefs: [] },
      { id: "ux-responsive", area: "responsive", requirement: "常用宽度不溢出", status: "pending", evidenceRefs: [] },
      { id: "ux-overlay", area: "overlay-interaction", requirement: "点击外部关闭临时弹层", status: "pending", evidenceRefs: [] },
    ],
  },
};

assert.deepEqual(validateDeliveryGovernance(valid), []);
assert.match(
  validateDeliveryGovernance(valid, { requireResolved: true }).join("\n"),
  /最终交付前必须为 passed 或 not-applicable/,
);
assert.deepEqual(
  validateDeliveryGovernanceRefs(valid, {
    scenarioIds: new Set(["scenario-core"]),
    stateIds: new Set(["state-failed"]),
  }),
  [],
);

const invalid = structuredClone(valid);
invalid.capabilityCatalog[1].requirementTreatment = "include";
invalid.changeImpacts[0].acceptanceScenarioRefs = [];
invalid.b2bExperience.checks = invalid.b2bExperience.checks.filter((item) => item.area !== "responsive");
const errors = validateDeliveryGovernance(invalid).join("\n");
assert.match(errors, /requirementTreatment 应为 exclude/);
assert.match(errors, /acceptanceScenarioRefs 必须是非空字符串数组/);
assert.match(errors, /缺少必查领域：responsive/);

const refErrors = validateDeliveryGovernanceRefs(valid, {
  scenarioIds: new Set(["scenario-other"]),
  stateIds: new Set(["state-other"]),
}).join("\n");
assert.match(refErrors, /不存在的状态/);
assert.match(refErrors, /不存在的场景/);

const missingSources = validateDeliveryGovernanceRefs(valid, {
  scenarioIds: new Set(),
  stateIds: new Set(),
}).join("\n");
assert.match(missingSources, /不存在的状态/);
assert.match(missingSources, /不存在的场景/);

console.log("交付治理测试通过：覆盖能力用途、变更影响、B 端体验与跨文件引用");
