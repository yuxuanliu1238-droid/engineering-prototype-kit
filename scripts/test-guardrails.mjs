import { validateContractsData } from "./contract-lib.mjs";
import { printResult, readJson } from "./project-lib.mjs";
import {
  EXPECTED_AI_POLICIES,
  EXPECTED_ARTIFACT_TYPES,
  EXPECTED_EXECUTION_STATES,
  EXPECTED_NODE_STATUSES,
  EXPECTED_READINESS_CHECK_IDS,
  EXPECTED_READINESS_STATUSES,
  EXPECTED_STAGE_IDS,
  EXPECTED_WAITING_REASON_CODES,
  validateRegistryData,
} from "./workflow-lib.mjs";

const errors = [];
const config = await readJson("project.config.json");

function expectError(label, actualErrors, pattern) {
  if (!actualErrors.some((error) => pattern.test(error))) {
    errors.push(`${label} 未被正确拦截`);
  }
}

function expectNoErrors(label, actualErrors) {
  if (actualErrors.length) {
    errors.push(`${label} 被误阻断：${actualErrors.join("；")}`);
  }
}

function makeNodes() {
  return EXPECTED_STAGE_IDS.map((stageId, index) => ({
    stageId,
    status: index === 0 ? "已完成" : EXPECTED_NODE_STATUSES[0],
  }));
}

function makeReadiness(status = "not-assessed") {
  return EXPECTED_READINESS_CHECK_IDS.map((id) => ({
    id,
    status,
    evidence: status === "met" ? [`test:${id}`] : [],
  }));
}

function makeRegistry(item) {
  return {
    schemaVersion: 2,
    stageDefinitions: EXPECTED_STAGE_IDS.map((id) => ({
      id,
      label: id,
      required: id !== "decision-record",
    })),
    nodeStatuses: EXPECTED_NODE_STATUSES,
    taskControlDefinitions: {
      executionStates: EXPECTED_EXECUTION_STATES,
      aiPolicies: EXPECTED_AI_POLICIES,
      readinessStatuses: EXPECTED_READINESS_STATUSES,
      waitingReasonCodes: EXPECTED_WAITING_REASON_CODES,
      artifactTypes: EXPECTED_ARTIFACT_TYPES,
    },
    items: [item],
  };
}

const baseItem = {
  id: "CR-001",
  summary: "示例需求",
  originalRequest: "记录需求但尚未授权实施",
  source: "test",
  proposedAt: "2026-01-01",
  currentStageId: "waiting-start",
  overallStatus: "未同步",
  executionState: "locked",
  aiPolicy: "unassessed",
  waitingReason: null,
  readinessChecklist: makeReadiness(),
  artifacts: [],
  pageIds: [],
  actionIds: [],
  stateIds: [],
  documents: [],
  evidence: [],
  nodes: makeNodes(),
};

const unauthorizedItem = structuredClone(baseItem);
unauthorizedItem.pageIds = ["sample.page"];
const unauthorized = makeRegistry(unauthorizedItem);
expectError(
  "未完成影响分析却预填页面",
  validateRegistryData(unauthorized),
  /尚未完成影响分析/,
);

const syncedWithoutReview = structuredClone(unauthorized);
syncedWithoutReview.items[0].currentStageId = "synced";
syncedWithoutReview.items[0].overallStatus = "已同步";
syncedWithoutReview.items[0].pageIds = [];
expectError(
  "无用户证据却标记已同步",
  validateRegistryData(syncedWithoutReview),
  /缺少 userConfirmationDate/,
);

const readyWithoutAuthorization = makeRegistry({
  ...structuredClone(baseItem),
  currentStageId: "impact-analysis",
  overallStatus: "同步中",
  executionState: "ready",
});
expectError(
  "未评估 AI 策略却进入可执行",
  validateRegistryData(readyWithoutAuthorization),
  /未满足就绪条件/,
);

const executionWithoutReadiness = makeRegistry({
  ...structuredClone(baseItem),
  currentStageId: "impact-analysis",
  overallStatus: "同步中",
  executionState: "in-progress",
  aiPolicy: "execution-allowed",
});
expectError(
  "已授权但未完成就绪检查",
  validateRegistryData(executionWithoutReadiness),
  /未满足就绪条件/,
);

const waitingWithoutPacket = makeRegistry({
  ...structuredClone(baseItem),
  executionState: "waiting-human",
});
expectError(
  "等待人工但缺少介入单",
  validateRegistryData(waitingWithoutPacket),
  /waitingReason 必须是对象/,
);

const completedWithoutArtifacts = makeRegistry({
  ...structuredClone(baseItem),
  executionState: "completed",
});
expectError(
  "无类型化产物却声称完成",
  validateRegistryData(completedWithoutArtifacts),
  /已完成但缺少类型化产物/,
);

const invalidArtifactType = makeRegistry({
  ...structuredClone(baseItem),
  artifacts: [{ type: "chat-message", location: "chat:1", supports: [] }],
});
expectError(
  "非法产物类型",
  validateRegistryData(invalidArtifactType),
  /artifacts\[0\]\.type 无效/,
);

const planningReady = makeRegistry({
  ...structuredClone(baseItem),
  currentStageId: "impact-analysis",
  overallStatus: "同步中",
  executionState: "ready",
  aiPolicy: "planning-only",
  readinessChecklist: makeReadiness().map((check) =>
    check.id === "goal-clear"
      ? { ...check, status: "met", evidence: ["request:CR-001"] }
      : check,
  ),
});
expectNoErrors("合法规划就绪", validateRegistryData(planningReady));

const executionReady = makeRegistry({
  ...structuredClone(baseItem),
  currentStageId: "interactive-prototype",
  overallStatus: "同步中",
  executionState: "in-progress",
  aiPolicy: "execution-allowed",
  readinessChecklist: makeReadiness("met"),
});
expectNoErrors("合法实施就绪", validateRegistryData(executionReady));

const completedNodes = makeNodes().map((node) => ({ ...node, status: "已完成" }));
const validSynced = makeRegistry({
  ...structuredClone(baseItem),
  currentStageId: "synced",
  overallStatus: "已同步",
  executionState: "completed",
  aiPolicy: "execution-allowed",
  readinessChecklist: makeReadiness("met"),
  artifacts: [
    { type: "test-report", location: "command:pnpm-check", supports: ["AC-001"] },
    {
      type: "user-confirmation",
      location: "review:2026-01-02",
      supports: ["user-review"],
    },
  ],
  evidence: ["review:2026-01-02"],
  userConfirmationDate: "2026-01-02",
  nodes: completedNodes,
});
expectNoErrors("合法已同步闭环", validateRegistryData(validSynced));

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
  "8 类风险被阻断，3 条合法路径未被误拦截",
);
