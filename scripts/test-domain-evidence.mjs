import assert from "node:assert/strict";
import {
  validateDomainEvidence,
  validateReviewScenarios,
  validateScenarioClosure,
} from "./domain-evidence-lib.mjs";

const domain = {
  schemaVersion: 1,
  ruleModel: {
    fields: [
      {
        id: "field-region",
        label: "区域",
        dataSourceRef: "source-order",
        valueType: "entity-set",
        operators: ["includes", "excludes"],
        repeatPolicy: "forbid",
        missingDataPolicy: "undecidable",
      },
    ],
    rules: [
      {
        id: "rule-region",
        label: "区域规则",
        conditionLogic: "all",
        conditions: [{ fieldRef: "field-region", operator: "includes", valueRef: "region:north" }],
        resultRef: "result:standard",
      },
    ],
    selection: { strategy: "most-specific-complete-match", unresolvedTie: "conflict" },
  },
  stateModel: {
    states: [{ id: "state-ready", objectType: "business-object", meaning: "已有明确结果", source: true }],
    actions: [
      {
        id: "action-review",
        label: "查看结果",
        allowedStateRefs: ["state-ready"],
        forbiddenStateRefs: [],
        successStateRef: "state-ready",
      },
    ],
    exceptions: [],
  },
  integrationModel: {
    fields: [
      {
        id: "field-duration",
        label: "外部时长",
        sourceType: "external-return",
        owner: "外部服务",
        sourceRef: "service-route",
        timing: "业务对象进入计算时",
        missingPolicy: "阻断依赖该字段的判断",
      },
      {
        id: "field-arrival",
        label: "规划到达时间",
        sourceType: "system-derived",
        owner: "本系统",
        sourceRef: "derive-arrival",
        timing: "取得外部时长后",
        missingPolicy: "不生成依赖结果",
      },
    ],
    derivations: [
      {
        id: "derive-arrival",
        inputFieldRefs: ["field-duration"],
        outputFieldRef: "field-arrival",
        formula: "业务开始时间 + 外部时长",
        timing: "外部调用成功后一次计算",
      },
    ],
  },
};

const scenarios = {
  schemaVersion: 2,
  reviewCenterEnabled: true,
  reviewRoute: "/review",
  businessRoute: "/app",
  scenarios: [
    {
      id: "core-flow",
      category: "主流程",
      name: "核心流程",
      validationQuestion: "是否形成唯一、可解释的业务结果？",
      entryPath: "/app?scenario=core-flow",
      dataRefs: ["fixture:core-flow"],
      preconditions: ["加载可恢复数据"],
      expectedResult: "形成唯一结果",
      expected: {
        matchedRuleRefs: ["rule-region"],
        selectedRuleRef: "rule-region",
        resultRef: "result:standard",
        sourceStateRef: "state-ready",
        exceptionRef: null,
        assertions: { visible: ["明确结果"], hidden: [] },
      },
      sources: ["ai-candidate"],
      assumptions: [],
      openQuestions: [],
      owner: "产品经理",
      status: "pending",
    },
  ],
};

assert.deepEqual(validateDomainEvidence(domain).errors, []);
assert.deepEqual(validateReviewScenarios(scenarios), []);
assert.deepEqual(validateScenarioClosure(scenarios, domain), []);

const brokenDomain = structuredClone(domain);
brokenDomain.ruleModel.rules[0].conditions[0].operator = "greater-than";
brokenDomain.stateModel.actions[0].allowedStateRefs = ["state-missing"];
brokenDomain.integrationModel.derivations[0].outputFieldRef = "field-duration";
const brokenErrors = validateDomainEvidence(brokenDomain).errors.join("\n");
assert.match(brokenErrors, /可用判断关系/);
assert.match(brokenErrors, /不存在的 id：state-missing/);
assert.match(brokenErrors, /system-derived/);

const brokenScenarios = structuredClone(scenarios);
brokenScenarios.scenarios[0].expected.selectedRuleRef = "rule-missing";
assert.match(validateReviewScenarios(brokenScenarios).join("\n"), /必须包含在 matchedRuleRefs/);

const brokenClosure = structuredClone(scenarios);
brokenClosure.scenarios[0].expected.matchedRuleRefs = ["rule-missing"];
brokenClosure.scenarios[0].expected.selectedRuleRef = "rule-missing";
assert.match(validateScenarioClosure(brokenClosure, domain).join("\n"), /不存在的规则/);

console.log("领域证据校验测试通过：覆盖场景闭环、规则元模型、状态动作和外部数据推导链");
