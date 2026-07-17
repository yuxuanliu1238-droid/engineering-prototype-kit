import { validateContractsData } from "./contract-lib.mjs";
import { printResult, readJson } from "./project-lib.mjs";
import {
  EXPECTED_NODE_STATUSES,
  EXPECTED_STAGE_IDS,
  validateRegistryData,
} from "./workflow-lib.mjs";

const errors = [];
const config = await readJson("project.config.json");

function expectError(label, actualErrors, pattern) {
  if (!actualErrors.some((error) => pattern.test(error))) {
    errors.push(`${label} 未被正确拦截`);
  }
}

function makeNodes() {
  return EXPECTED_STAGE_IDS.map((stageId, index) => ({
    stageId,
    status: index === 0 ? "已完成" : EXPECTED_NODE_STATUSES[0],
  }));
}

const unauthorized = {
  schemaVersion: 1,
  stageDefinitions: EXPECTED_STAGE_IDS.map((id) => ({
    id,
    label: id,
    required: id !== "decision-record",
  })),
  nodeStatuses: EXPECTED_NODE_STATUSES,
  items: [
    {
      id: "CR-001",
      summary: "示例需求",
      originalRequest: "记录需求但尚未授权实施",
      source: "test",
      proposedAt: "2026-01-01",
      currentStageId: "waiting-start",
      overallStatus: "未同步",
      pageIds: ["sample.page"],
      actionIds: [],
      stateIds: [],
      documents: [],
      evidence: [],
      nodes: makeNodes(),
    },
  ],
};
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

printResult("护栏对抗测试", errors, "未授权影响、无评审同步和虚构接口均被阻断");
