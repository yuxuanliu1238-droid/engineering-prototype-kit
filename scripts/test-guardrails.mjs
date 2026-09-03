import { validateContractsData } from "./contract-lib.mjs";
import { printResult, readJson } from "./project-lib.mjs";
import {
  deriveStatusCard,
  makeActivities,
  makeEmptyRegistry,
  makeReadiness,
  validateRegistryData,
} from "./workflow-v3-lib.mjs";

const errors = [];
const config = await readJson("project.config.json");

function expectError(label, actualErrors, pattern) {
  if (!actualErrors.some((error) => pattern.test(error))) {
    errors.push(`${label} 未被正确拦截：${actualErrors.join("；")}`);
  }
}

function expectNoErrors(label, actualErrors) {
  if (actualErrors.length) {
    errors.push(`${label} 被误阻断：${actualErrors.join("；")}`);
  }
}

function makeRisk(level = "standard", overrides = {}) {
  const risk = {
    recommendedLevel: level,
    confirmedLevel: level,
    triggers: level === "high" ? ["product-outcome"] : [],
    rationale: "测试风险判断",
    proposedBy: "ai",
    confirmedBy: "product:test",
    confirmedAt: "2026-01-01",
    downgradeReason: null,
    compensationMeasures: [],
    ...overrides,
  };
  return risk;
}

function makeItem(overrides = {}) {
  const item = {
    id: "CR-001",
    summary: "示例需求",
    originalRequest: "记录需求但尚未授权实施",
    source: "test",
    proposedAt: "2026-01-01",
    currentStageId: "recorded",
    executionState: "locked",
    aiPolicy: "unassessed",
    executionScope: {
      objective: "验证任务控制",
      included: [],
      excluded: [],
      deferred: [],
    },
    riskAssessment: null,
    activities: [],
    waitingReason: null,
    pauseReason: null,
    cancellationReason: null,
    readinessChecklist: makeReadiness(),
    artifacts: [],
    reviewConfirmation: null,
    pageIds: [],
    actionIds: [],
    stateIds: [],
    documents: [],
    evidence: [],
    remainingRisks: [],
    openQuestions: [],
    ...overrides,
  };
  if (item.riskAssessment && overrides.activities === undefined) {
    item.activities = makeActivities(item.riskAssessment);
  }
  return item;
}

function makeRegistry(item) {
  return { ...makeEmptyRegistry(), items: [item] };
}

const prefilledImpact = makeItem({ pageIds: ["sample.page"] });
expectError(
  "分析确认前预填页面",
  validateRegistryData(makeRegistry(prefilledImpact)),
  /尚未进入实施阶段/,
);

const readyWithoutAuthorization = makeItem({ executionState: "ready" });
expectError(
  "未评估 AI 策略却进入可执行",
  validateRegistryData(makeRegistry(readyWithoutAuthorization)),
  /未满足就绪条件/,
);

const executionWithoutReadiness = makeItem({
  currentStageId: "implementation",
  executionState: "in-progress",
  aiPolicy: "execution-allowed",
  riskAssessment: makeRisk("standard"),
});
expectError(
  "已授权但未完成就绪检查",
  validateRegistryData(makeRegistry(executionWithoutReadiness)),
  /未满足就绪条件/,
);

const waitingWithoutPacket = makeItem({ executionState: "waiting-human" });
expectError(
  "等待人工但缺少介入单",
  validateRegistryData(makeRegistry(waitingWithoutPacket)),
  /waitingReason 必须是对象/,
);

const pausedWithoutReason = makeItem({ executionState: "paused" });
expectError(
  "暂停但缺少恢复条件",
  validateRegistryData(makeRegistry(pausedWithoutReason)),
  /pauseReason 必须是对象/,
);

const cancelledWithoutReason = makeItem({ executionState: "cancelled" });
expectError(
  "取消但缺少原因",
  validateRegistryData(makeRegistry(cancelledWithoutReason)),
  /cancellationReason 缺失/,
);

const invalidDowngradeRisk = makeRisk("high", {
  confirmedLevel: "standard",
  triggers: ["permissions"],
});
const invalidDowngrade = makeItem({
  currentStageId: "analysis-confirmation",
  riskAssessment: invalidDowngradeRisk,
});
expectError(
  "高风险无理由降级",
  validateRegistryData(makeRegistry(invalidDowngrade)),
  /高风险降级必须记录理由/,
);

const mismatchedActivities = makeItem({
  currentStageId: "analysis-confirmation",
  riskAssessment: makeRisk("light"),
  activities: [],
});
expectError(
  "风险活动清单缺失",
  validateRegistryData(makeRegistry(mismatchedActivities)),
  /activities 与风险等级和触发因素不一致/,
);

const completedWithoutReview = makeItem({
  currentStageId: "completed",
  executionState: "completed",
  aiPolicy: "execution-allowed",
  riskAssessment: makeRisk("light"),
  readinessChecklist: makeReadiness("met"),
});
expectError(
  "无产品评审却声称完成",
  validateRegistryData(makeRegistry(completedWithoutReview)),
  /缺少有效产品评审确认/,
);

const invalidArtifact = makeItem({
  artifacts: [{ type: "chat-message", location: "chat:1", supports: [] }],
});
expectError(
  "非法产物类型",
  validateRegistryData(makeRegistry(invalidArtifact)),
  /artifacts\[0\]\.type 无效/,
);

const planningRisk = makeRisk("light");
const planningReady = makeItem({
  currentStageId: "analysis-confirmation",
  executionState: "ready",
  aiPolicy: "planning-only",
  riskAssessment: planningRisk,
  readinessChecklist: makeReadiness().map((check) =>
    check.id === "goal-clear"
      ? { ...check, status: "met", evidence: ["request:CR-001"] }
      : check,
  ),
});
expectNoErrors("合法规划就绪", validateRegistryData(makeRegistry(planningReady)));

const validCancelled = makeItem({
  executionState: "cancelled",
  cancellationReason: "产品经理确认不再继续本条需求",
});
expectNoErrors("合法取消并保留原因", validateRegistryData(makeRegistry(validCancelled)));

const executionRisk = makeRisk("standard");
const executionReady = makeItem({
  currentStageId: "implementation",
  executionState: "in-progress",
  aiPolicy: "execution-allowed",
  riskAssessment: executionRisk,
  readinessChecklist: makeReadiness("met"),
});
expectNoErrors("合法实施就绪", validateRegistryData(makeRegistry(executionReady)));

const completedRisk = makeRisk("high", {
  triggers: ["product-outcome", "lifecycle", "failure-recovery", "permissions"],
});
const completedActivities = makeActivities(completedRisk).map((activity) => ({
  ...activity,
  status: "已完成",
  evidence: [`test:${activity.id}`],
  result: "检查通过",
}));
const validCompleted = makeItem({
  currentStageId: "completed",
  executionState: "completed",
  aiPolicy: "execution-allowed",
  riskAssessment: completedRisk,
  activities: completedActivities,
  readinessChecklist: makeReadiness("met"),
  artifacts: [
    { type: "test-report", location: "command:pnpm-check", supports: ["AC-001"] },
    {
      type: "user-confirmation",
      location: "review:2026-01-02",
      supports: ["product-review"],
    },
  ],
  reviewConfirmation: {
    outcome: "approved",
    continueBuild: true,
    confirmedScope: ["本次需求"],
    excludedScope: [],
    confirmedRules: ["测试规则"],
    nonBlockingQuestions: [],
    evidenceIds: [],
    confirmedBy: "product:test",
    confirmedAt: "2026-01-02",
  },
});
expectNoErrors("合法完成闭环", validateRegistryData(makeRegistry(validCompleted)));

const waitingCardItem = makeItem({
  executionState: "waiting-human",
  waitingReason: {
    code: "rule-ambiguity",
    question: "部分失败是否保留成功结果？",
    requestedFrom: "产品经理",
    impact: "未确认前无法实现批量结果处理",
    resumeWhen: "产品经理确认部分失败规则",
  },
});
const waitingCard = deriveStatusCard(waitingCardItem);
if (
  waitingCard.owner !== "产品经理" ||
  waitingCard.nextAction !== "部分失败是否保留成功结果？"
) {
  errors.push("简化状态卡未正确展示责任人和下一动作");
}

const invalidContract = [
  {
    schemaVersion: 1,
    pageId: "sample.page",
    surface: "web",
    title: "示例",
    goal: "测试防错",
    implementationStatus: "planned",
    preview: { entry: "index.html", defaultStateId: "sample.state" },
    sections: [],
    actions: [],
    states: [
      {
        id: "sample.state",
        label: "状态",
        enterWhen: "测试",
        visibleChanges: "测试",
        allowedActionIds: [],
        recovery: "测试",
        implementationStatus: "planned",
      },
    ],
    rules: [],
    dataFields: [],
    integrations: [
      {
        id: "sample.integration",
        status: "placeholder",
        url: "https://invented.example/api/test",
      },
    ],
    exceptions: [],
    acceptanceCriteria: [],
  },
];
expectError(
  "占位接口包含虚构 URL",
  validateContractsData(invalidContract, config),
  /不允许的接口 URL/,
);

printResult(
  "护栏对抗测试",
  errors,
  "10 类 V0.3 风险被阻断，4 条合法路径和简化状态卡通过",
);
