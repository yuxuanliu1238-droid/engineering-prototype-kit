import { assertObject, hasText, requireStringArray } from "./project-lib.mjs";

export const EXPECTED_STAGE_IDS = [
  "registered",
  "waiting-start",
  "impact-analysis",
  "rule-confirmation",
  "decision-record",
  "page-contract",
  "interactive-prototype",
  "page-spec",
  "consistency-check",
  "user-review",
  "synced",
];

export const EXPECTED_NODE_STATUSES = [
  "未开始",
  "进行中",
  "等待用户",
  "已完成",
  "已跳过",
  "被阻塞",
];

export const EXPECTED_EXECUTION_STATES = [
  "locked",
  "ready",
  "in-progress",
  "waiting-human",
  "completed",
  "cancelled",
];

export const EXPECTED_AI_POLICIES = [
  "unassessed",
  "planning-only",
  "execution-allowed",
  "human-only",
];

export const EXPECTED_READINESS_CHECK_IDS = [
  "goal-clear",
  "scope-clear",
  "acceptance-testable",
  "dependencies-clear",
  "rules-confirmed",
  "authorization-confirmed",
  "risk-reviewed",
];

export const EXPECTED_READINESS_STATUSES = [
  "not-assessed",
  "met",
  "not-met",
  "not-applicable",
];

export const EXPECTED_WAITING_REASON_CODES = [
  "missing-information",
  "rule-ambiguity",
  "authorization-required",
  "review-required",
  "validation-failed",
  "risk-exceeded",
  "dependency-blocked",
];

export const EXPECTED_ARTIFACT_TYPES = [
  "decision",
  "plan",
  "contract",
  "prototype",
  "page-guide",
  "test-report",
  "review-report",
  "user-confirmation",
  "commit",
  "release",
];

const NON_SKIPPABLE_READINESS_IDS = new Set([
  "goal-clear",
  "scope-clear",
  "acceptance-testable",
  "authorization-confirmed",
  "risk-reviewed",
]);

export function deriveOverallStatus(currentStageId) {
  if (currentStageId === "waiting-start") return "未同步";
  if (currentStageId === "synced") return "已同步";
  return "同步中";
}

export function deriveReadiness(item) {
  if (item.aiPolicy === "human-only") return "human-only";
  if (item.aiPolicy === "unassessed") return "needs-authorization";

  const checks = new Map(
    (item.readinessChecklist || []).map((check) => [check.id, check.status]),
  );
  if (item.aiPolicy === "planning-only") {
    return checks.get("goal-clear") === "met" ? "planning-ready" : "needs-input";
  }

  const executionReady = EXPECTED_READINESS_CHECK_IDS.every((id) => {
    const status = checks.get(id);
    if (NON_SKIPPABLE_READINESS_IDS.has(id)) return status === "met";
    return status === "met" || status === "not-applicable";
  });
  return executionReady ? "execution-ready" : "needs-input";
}

function validateWaitingReason(item, label, errors) {
  if (item.executionState !== "waiting-human") {
    if (item.waitingReason !== null) {
      errors.push(`${label}.waitingReason 非等待人工时必须为 null`);
    }
    return;
  }

  if (!assertObject(item.waitingReason, `${label}.waitingReason`, errors)) return;
  if (!EXPECTED_WAITING_REASON_CODES.includes(item.waitingReason.code)) {
    errors.push(`${label}.waitingReason.code 无效`);
  }
  for (const field of ["question", "requestedFrom", "impact", "resumeWhen"]) {
    if (!hasText(item.waitingReason[field])) {
      errors.push(`${label}.waitingReason.${field} 缺失`);
    }
  }
}

function validateReadiness(item, label, errors) {
  if (!Array.isArray(item.readinessChecklist)) {
    errors.push(`${label}.readinessChecklist 必须是数组`);
    return;
  }
  const actualIds = item.readinessChecklist.map((check) => check.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(EXPECTED_READINESS_CHECK_IDS)) {
    errors.push(`${label}.readinessChecklist 必须覆盖固定检查项并保持顺序`);
  }
  item.readinessChecklist.forEach((check, index) => {
    const checkLabel = `${label}.readinessChecklist[${index}]`;
    if (!assertObject(check, checkLabel, errors)) return;
    if (!EXPECTED_READINESS_STATUSES.includes(check.status)) {
      errors.push(`${checkLabel}.status 无效`);
    }
    requireStringArray(check.evidence, `${checkLabel}.evidence`, errors);
    if (check.status === "met" && !(check.evidence || []).length) {
      errors.push(`${checkLabel} 标记为 met 时必须包含证据`);
    }
  });
}

function validateArtifacts(item, label, errors) {
  if (!Array.isArray(item.artifacts)) {
    errors.push(`${label}.artifacts 必须是数组`);
    return;
  }
  item.artifacts.forEach((artifact, index) => {
    const artifactLabel = `${label}.artifacts[${index}]`;
    if (!assertObject(artifact, artifactLabel, errors)) return;
    if (!EXPECTED_ARTIFACT_TYPES.includes(artifact.type)) {
      errors.push(`${artifactLabel}.type 无效`);
    }
    if (!hasText(artifact.location)) errors.push(`${artifactLabel}.location 缺失`);
    requireStringArray(artifact.supports, `${artifactLabel}.supports`, errors);
    if (Array.isArray(artifact.supports) && artifact.supports.length === 0) {
      errors.push(`${artifactLabel}.supports 至少包含一个验收项或结论`);
    }
  });
}

export function validateRegistryData(registry) {
  const errors = [];
  if (!assertObject(registry, "需求台账", errors)) return errors;
  if (registry.schemaVersion !== 2) errors.push("需求台账 schemaVersion 必须为 2");

  if (!Array.isArray(registry.stageDefinitions)) {
    errors.push("stageDefinitions 必须是数组");
  } else {
    const actual = registry.stageDefinitions.map((stage) => stage.id);
    if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_STAGE_IDS)) {
      errors.push("流程节点顺序或编号与固定流程不一致");
    }
    registry.stageDefinitions.forEach((stage, index) => {
      if (!assertObject(stage, `stageDefinitions[${index}]`, errors)) return;
      if (!hasText(stage.label)) errors.push(`stageDefinitions[${index}].label 缺失`);
      if (typeof stage.required !== "boolean") {
        errors.push(`stageDefinitions[${index}].required 必须是布尔值`);
      }
    });
  }

  if (JSON.stringify(registry.nodeStatuses) !== JSON.stringify(EXPECTED_NODE_STATUSES)) {
    errors.push("节点状态集合与固定定义不一致");
  }

  const controlDefinitions = registry.taskControlDefinitions;
  if (!assertObject(controlDefinitions, "taskControlDefinitions", errors)) {
    return errors;
  }
  const expectedControlDefinitions = {
    executionStates: EXPECTED_EXECUTION_STATES,
    aiPolicies: EXPECTED_AI_POLICIES,
    readinessStatuses: EXPECTED_READINESS_STATUSES,
    waitingReasonCodes: EXPECTED_WAITING_REASON_CODES,
    artifactTypes: EXPECTED_ARTIFACT_TYPES,
  };
  for (const [field, expected] of Object.entries(expectedControlDefinitions)) {
    if (JSON.stringify(controlDefinitions[field]) !== JSON.stringify(expected)) {
      errors.push(`taskControlDefinitions.${field} 与固定定义不一致`);
    }
  }

  if (!Array.isArray(registry.items)) {
    errors.push("items 必须是数组");
    return errors;
  }

  const ids = new Set();
  registry.items.forEach((item, index) => {
    const label = `items[${index}]`;
    if (!assertObject(item, label, errors)) return;
    if (!/^CR-\d{3}$/.test(item.id || "")) errors.push(`${label}.id 必须形如 CR-001`);
    if (ids.has(item.id)) errors.push(`CR 编号重复：${item.id}`);
    ids.add(item.id);

    for (const field of ["summary", "originalRequest", "source", "proposedAt"]) {
      if (!hasText(item[field])) errors.push(`${label}.${field} 缺失`);
    }
    if (!EXPECTED_STAGE_IDS.includes(item.currentStageId)) {
      errors.push(`${label}.currentStageId 无效`);
    }
    if (!EXPECTED_EXECUTION_STATES.includes(item.executionState)) {
      errors.push(`${label}.executionState 无效`);
    }
    if (!EXPECTED_AI_POLICIES.includes(item.aiPolicy)) {
      errors.push(`${label}.aiPolicy 无效`);
    }
    for (const field of ["pageIds", "actionIds", "stateIds", "documents", "evidence"]) {
      requireStringArray(item[field], `${label}.${field}`, errors);
    }
    if (!Array.isArray(item.nodes)) errors.push(`${label}.nodes 必须是数组`);
    else {
      const nodeIds = item.nodes.map((node) => node.stageId);
      if (JSON.stringify(nodeIds) !== JSON.stringify(EXPECTED_STAGE_IDS)) {
        errors.push(`${label}.nodes 必须覆盖固定流程并保持顺序`);
      }
      item.nodes.forEach((node, nodeIndex) => {
        if (!EXPECTED_NODE_STATUSES.includes(node.status)) {
          errors.push(`${label}.nodes[${nodeIndex}].status 无效`);
        }
      });
    }

    validateWaitingReason(item, label, errors);
    validateReadiness(item, label, errors);
    validateArtifacts(item, label, errors);

    const readiness = deriveReadiness(item);
    if (["ready", "in-progress"].includes(item.executionState)) {
      if (!["planning-ready", "execution-ready"].includes(readiness)) {
        errors.push(`${item.id} 未满足就绪条件，不得进入 ${item.executionState}`);
      }
    }
    if (
      item.aiPolicy === "planning-only" &&
      ["decision-record", "page-contract", "interactive-prototype", "page-spec"].includes(
        item.currentStageId,
      ) &&
      item.executionState === "in-progress"
    ) {
      errors.push(`${item.id} 仅授权 AI 规划，不得在实施节点进行中`);
    }
    if (item.executionState === "completed" && !(item.artifacts || []).length) {
      errors.push(`${item.id} 已完成但缺少类型化产物`);
    }
    if (item.executionState === "completed" && item.aiPolicy === "unassessed") {
      errors.push(`${item.id} 已完成但 AI 策略仍未评估`);
    }

    const stageIndex = EXPECTED_STAGE_IDS.indexOf(item.currentStageId);
    const impactIndex = EXPECTED_STAGE_IDS.indexOf("impact-analysis");
    if (
      stageIndex < impactIndex &&
      [...(item.pageIds || []), ...(item.actionIds || []), ...(item.stateIds || [])].length
    ) {
      errors.push(`${item.id} 尚未完成影响分析，不得预填 Page、Action 或 State ID`);
    }

    if (item.currentStageId === "synced") {
      if (!hasText(item.userConfirmationDate)) {
        errors.push(`${item.id} 已同步但缺少 userConfirmationDate`);
      }
      const reviewNode = (item.nodes || []).find((node) => node.stageId === "user-review");
      if (reviewNode?.status !== "已完成") {
        errors.push(`${item.id} 已同步但用户评审节点未完成`);
      }
      if (!(item.evidence || []).length) errors.push(`${item.id} 已同步但缺少证据`);
      if (item.executionState !== "completed") {
        errors.push(`${item.id} 已同步时 executionState 必须为 completed`);
      }
      if (!(item.artifacts || []).some((artifact) => artifact.type === "user-confirmation")) {
        errors.push(`${item.id} 已同步但缺少 user-confirmation 产物`);
      }
      if (
        !(item.artifacts || []).some((artifact) =>
          ["test-report", "review-report"].includes(artifact.type),
        )
      ) {
        errors.push(`${item.id} 已同步但缺少 test-report 或 review-report 产物`);
      }
    }

    if (
      hasText(item.overallStatus) &&
      item.overallStatus !== deriveOverallStatus(item.currentStageId)
    ) {
      errors.push(`${item.id}.overallStatus 必须由 currentStageId 确定性推导`);
    }
  });

  return errors;
}

export function renderRequirements(registry) {
  const lines = [
    "# 需求池",
    "",
    "<!-- 此文件由 docs/requirements/registry.json 确定性生成，请勿直接编辑。 -->",
    "",
  ];
  if (!registry.items.length) {
    lines.push("当前没有已登记的增量需求。", "");
    return lines.join("\n");
  }
  lines.push(
    "| 编号 | 需求一句话 | 总状态 | 当前节点 | 执行状态 | AI 策略 | 就绪结论 |",
    "|---|---|---|---|---|---|---|",
  );
  for (const item of registry.items) {
    lines.push(
      `| ${item.id} | ${item.summary.replaceAll("|", "\\|")} | ${deriveOverallStatus(item.currentStageId)} | ${item.currentStageId} | ${item.executionState} | ${item.aiPolicy} | ${deriveReadiness(item)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
