import { assertObject, hasText, requireStringArray } from "./project-lib.mjs";

export const EXPECTED_STAGE_IDS = [
  "recorded",
  "analysis-confirmation",
  "implementation",
  "awaiting-review",
  "completed",
];

export const STAGE_LABELS = {
  recorded: "已记录",
  "analysis-confirmation": "分析确认",
  implementation: "实施中",
  "awaiting-review": "待评审",
  completed: "已完成",
};

export const EXPECTED_ACTIVITY_STATUSES = [
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
  "paused",
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
  "business-baseline",
  "decision",
  "plan",
  "contract",
  "prototype",
  "page-guide",
  "test-report",
  "review-report",
  "review-confirmation",
  "user-confirmation",
  "migration-report",
  "commit",
  "release",
];

export const EXPECTED_RISK_LEVELS = ["light", "standard", "high"];

export const EXPECTED_RISK_TRIGGERS = [
  "product-outcome",
  "prohibited-restoration",
  "lifecycle",
  "role-responsibility",
  "failure-recovery",
  "external-system",
  "batch-async",
  "permissions",
  "data-scope",
  "money",
  "destructive",
  "sensitive-data",
  "security",
];

export const EXPECTED_EVIDENCE_SOURCE_TYPES = [
  "meeting",
  "feishu",
  "email",
  "jira",
  "customer-site",
  "document",
  "command",
  "review",
  "legacy-reference",
  "other",
];

export const EXPECTED_EVIDENCE_STATUSES = [
  "candidate",
  "confirmed",
  "rejected",
  "legacy",
];

export const ACTIVITY_LABELS = {
  "scope-confirmation": "范围确认",
  implementation: "实施",
  "page-check": "页面检查",
  "impact-analysis": "影响分析",
  "rule-confirmation": "规则确认",
  "decision-record": "正式决策",
  "domain-model": "领域模型",
  "exception-analysis": "异常分析",
  "page-contract": "页面契约",
  "interactive-prototype": "原型",
  "consistency-check": "一致性检查",
  "specialist-review": "专项确认",
  "product-review": "产品评审",
};

const NON_SKIPPABLE_READINESS_IDS = new Set([
  "goal-clear",
  "scope-clear",
  "acceptance-testable",
  "authorization-confirmed",
  "risk-reviewed",
]);

const DECISION_TRIGGERS = new Set(["product-outcome", "prohibited-restoration"]);
const DOMAIN_TRIGGERS = new Set(["lifecycle", "role-responsibility"]);
const EXCEPTION_TRIGGERS = new Set([
  "failure-recovery",
  "external-system",
  "batch-async",
]);
const SPECIALIST_TRIGGERS = new Set([
  "permissions",
  "data-scope",
  "money",
  "destructive",
  "sensitive-data",
  "security",
]);

function hasAnyTrigger(triggers, expected) {
  return (triggers || []).some((trigger) => expected.has(trigger));
}

export function buildActivityIds(riskAssessment) {
  const level = riskAssessment?.confirmedLevel;
  const triggers = riskAssessment?.triggers || [];
  if (!level) return [];
  if (level === "light") {
    return ["scope-confirmation", "implementation", "page-check", "product-review"];
  }

  const ids = ["impact-analysis", "rule-confirmation"];
  if (level === "high" && hasAnyTrigger(triggers, DECISION_TRIGGERS)) {
    ids.push("decision-record");
  }
  if (level === "high" && hasAnyTrigger(triggers, DOMAIN_TRIGGERS)) {
    ids.push("domain-model");
  }
  if (level === "high" && hasAnyTrigger(triggers, EXCEPTION_TRIGGERS)) {
    ids.push("exception-analysis");
  }
  ids.push("page-contract", "interactive-prototype", "consistency-check");
  if (level === "high" && hasAnyTrigger(triggers, SPECIALIST_TRIGGERS)) {
    ids.push("specialist-review");
  }
  ids.push("product-review");
  return ids;
}

export function makeActivities(riskAssessment) {
  return buildActivityIds(riskAssessment).map((id) => ({
    id,
    status: "未开始",
    evidence: [],
    result: null,
  }));
}

export function makeReadiness(status = "not-assessed") {
  return EXPECTED_READINESS_CHECK_IDS.map((id) => ({
    id,
    status,
    evidence: status === "met" ? [`generated:${id}`] : [],
  }));
}

export function makeEmptyRegistry() {
  return {
    schemaVersion: 3,
    stageDefinitions: EXPECTED_STAGE_IDS.map((id) => ({
      id,
      label: STAGE_LABELS[id],
      required: true,
    })),
    activityStatuses: EXPECTED_ACTIVITY_STATUSES,
    taskControlDefinitions: {
      executionStates: EXPECTED_EXECUTION_STATES,
      aiPolicies: EXPECTED_AI_POLICIES,
      readinessStatuses: EXPECTED_READINESS_STATUSES,
      waitingReasonCodes: EXPECTED_WAITING_REASON_CODES,
      artifactTypes: EXPECTED_ARTIFACT_TYPES,
      riskLevels: EXPECTED_RISK_LEVELS,
      riskTriggers: EXPECTED_RISK_TRIGGERS,
      evidenceSourceTypes: EXPECTED_EVIDENCE_SOURCE_TYPES,
      evidenceStatuses: EXPECTED_EVIDENCE_STATUSES,
    },
    items: [],
  };
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

export function deriveOverallStatus(item) {
  if (item.executionState === "cancelled") return "已取消";
  if (item.executionState === "paused") return "已暂停";
  if (item.executionState === "waiting-human") return "等待确认";
  return STAGE_LABELS[item.currentStageId] || item.currentStageId;
}

function firstIncompleteActivity(item) {
  return (item.activities || []).find(
    (activity) => !["已完成", "已跳过"].includes(activity.status),
  );
}

function firstMissingReadiness(item) {
  return (item.readinessChecklist || []).find((check) =>
    ["not-assessed", "not-met"].includes(check.status),
  );
}

const READINESS_LABELS = {
  "goal-clear": "目标和背景",
  "scope-clear": "范围和非目标",
  "acceptance-testable": "可观察验收标准",
  "dependencies-clear": "依赖",
  "rules-confirmed": "业务规则",
  "authorization-confirmed": "实施授权",
  "risk-reviewed": "风险评估",
};

export function deriveStatusCard(item) {
  const stage = STAGE_LABELS[item.currentStageId] || item.currentStageId;
  if (item.executionState === "waiting-human") {
    return {
      stage,
      verdict: "等待确认",
      reason: item.waitingReason?.impact || "存在需要人工确认的问题",
      owner: item.waitingReason?.requestedFrom || "产品经理",
      nextAction: item.waitingReason?.question || "回答当前唯一问题",
    };
  }
  if (item.executionState === "paused") {
    return {
      stage,
      verdict: "已暂停",
      reason: item.pauseReason?.reason || "任务已暂停",
      owner: "产品经理",
      nextAction: item.pauseReason?.resumeWhen || "确认恢复条件",
    };
  }
  if (item.executionState === "cancelled") {
    return {
      stage,
      verdict: "已取消",
      reason: item.cancellationReason || "任务已取消",
      owner: "产品经理",
      nextAction: "无",
    };
  }
  if (item.currentStageId === "completed" && item.executionState === "completed") {
    return {
      stage,
      verdict: "需求已完成",
      reason: "产品经理已完成最终评审确认",
      owner: "产品经理",
      nextAction: "无",
    };
  }
  if (item.currentStageId === "awaiting-review") {
    return {
      stage,
      verdict: "等待产品评审",
      reason: "实施和检查已完成，AI 不能自行宣布需求完成",
      owner: "产品经理",
      nextAction: "核对范围和验收标准并给出评审结论",
    };
  }

  const readiness = deriveReadiness(item);
  if (readiness === "needs-authorization") {
    return {
      stage,
      verdict: "暂不能实施",
      reason: "AI 策略尚未评估",
      owner: "产品经理",
      nextAction: "确认本条需求只允许规划、允许实施或必须人工处理",
    };
  }
  if (readiness === "human-only") {
    return {
      stage,
      verdict: "仅允许人工处理",
      reason: "本条需求的 AI 策略为 human-only",
      owner: "产品经理",
      nextAction: "指定人工负责人和处理方式",
    };
  }
  if (readiness === "needs-input") {
    const missing = firstMissingReadiness(item);
    const label = READINESS_LABELS[missing?.id] || "必要信息";
    return {
      stage,
      verdict: "暂不能实施",
      reason: `${label}尚未满足`,
      owner: "产品经理",
      nextAction: `补充或确认${label}`,
    };
  }

  const nextActivity = firstIncompleteActivity(item);
  if (readiness === "planning-ready") {
    return {
      stage,
      verdict: "可以规划",
      reason: "已满足规划条件，但没有获得实施授权",
      owner: "AI",
      nextAction: nextActivity
        ? `准备${ACTIVITY_LABELS[nextActivity.id] || nextActivity.id}`
        : "完成影响分析和问题拆分",
    };
  }
  return {
    stage,
    verdict: "可以实施",
    reason: "授权和必要就绪条件均已满足",
    owner: "AI",
    nextAction: nextActivity
      ? `执行${ACTIVITY_LABELS[nextActivity.id] || nextActivity.id}`
      : "将需求提交产品评审",
  };
}

function validateWaitingAndTerminalReasons(item, label, errors) {
  if (item.executionState === "waiting-human") {
    if (!assertObject(item.waitingReason, `${label}.waitingReason`, errors)) return;
    if (!EXPECTED_WAITING_REASON_CODES.includes(item.waitingReason.code)) {
      errors.push(`${label}.waitingReason.code 无效`);
    }
    for (const field of ["question", "requestedFrom", "impact", "resumeWhen"]) {
      if (!hasText(item.waitingReason[field])) {
        errors.push(`${label}.waitingReason.${field} 缺失`);
      }
    }
  } else if (item.waitingReason !== null) {
    errors.push(`${label}.waitingReason 非等待人工时必须为 null`);
  }

  if (item.executionState === "paused") {
    if (assertObject(item.pauseReason, `${label}.pauseReason`, errors)) {
      for (const field of ["reason", "resumeWhen"]) {
        if (!hasText(item.pauseReason[field])) errors.push(`${label}.pauseReason.${field} 缺失`);
      }
    }
  } else if (item.pauseReason !== null) {
    errors.push(`${label}.pauseReason 非暂停时必须为 null`);
  }

  if (item.executionState === "cancelled") {
    if (!hasText(item.cancellationReason)) errors.push(`${label}.cancellationReason 缺失`);
  } else if (item.cancellationReason !== null) {
    errors.push(`${label}.cancellationReason 非取消时必须为 null`);
  }
}

function validateReadiness(item, label, errors) {
  if (!Array.isArray(item.readinessChecklist)) {
    errors.push(`${label}.readinessChecklist 必须是数组`);
    return;
  }
  const ids = item.readinessChecklist.map((check) => check.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_READINESS_CHECK_IDS)) {
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

function validateExecutionScope(item, label, errors) {
  if (!assertObject(item.executionScope, `${label}.executionScope`, errors)) return;
  if (!hasText(item.executionScope.objective)) {
    errors.push(`${label}.executionScope.objective 缺失`);
  }
  for (const field of ["included", "excluded", "deferred"]) {
    requireStringArray(item.executionScope[field], `${label}.executionScope.${field}`, errors);
  }
}

function validateRisk(item, label, errors) {
  const risk = item.riskAssessment;
  if (risk === null) {
    if (item.currentStageId !== "recorded") {
      errors.push(`${label}.riskAssessment 进入分析确认后不得为空`);
    }
    if ((item.activities || []).length) {
      errors.push(`${label} 风险未确认时不得生成活动清单`);
    }
    return;
  }
  if (!assertObject(risk, `${label}.riskAssessment`, errors)) return;
  if (!EXPECTED_RISK_LEVELS.includes(risk.recommendedLevel)) {
    errors.push(`${label}.riskAssessment.recommendedLevel 无效`);
  }
  if (!EXPECTED_RISK_LEVELS.includes(risk.confirmedLevel)) {
    errors.push(`${label}.riskAssessment.confirmedLevel 无效`);
  }
  requireStringArray(risk.triggers, `${label}.riskAssessment.triggers`, errors);
  for (const trigger of risk.triggers || []) {
    if (!EXPECTED_RISK_TRIGGERS.includes(trigger)) {
      errors.push(`${label}.riskAssessment.triggers 包含无效值：${trigger}`);
    }
  }
  if (!hasText(risk.rationale)) errors.push(`${label}.riskAssessment.rationale 缺失`);
  if (risk.proposedBy !== "ai") errors.push(`${label}.riskAssessment.proposedBy 必须为 ai`);
  if (!hasText(risk.confirmedBy)) errors.push(`${label}.riskAssessment.confirmedBy 缺失`);
  if (!hasText(risk.confirmedAt)) errors.push(`${label}.riskAssessment.confirmedAt 缺失`);
  requireStringArray(
    risk.compensationMeasures,
    `${label}.riskAssessment.compensationMeasures`,
    errors,
  );
  if (risk.confirmedLevel === "high" && !(risk.triggers || []).length) {
    errors.push(`${label} 高风险必须包含至少一个触发因素`);
  }
  if (risk.recommendedLevel === "high" && risk.confirmedLevel !== "high") {
    if (!hasText(risk.downgradeReason)) errors.push(`${label} 高风险降级必须记录理由`);
    if (!(risk.compensationMeasures || []).length) {
      errors.push(`${label} 高风险降级必须记录验证补偿措施`);
    }
  } else if (risk.downgradeReason !== null) {
    errors.push(`${label}.riskAssessment.downgradeReason 非高风险降级时必须为 null`);
  }
}

function validateActivities(item, label, errors) {
  if (!Array.isArray(item.activities)) {
    errors.push(`${label}.activities 必须是数组`);
    return;
  }
  const expectedIds = buildActivityIds(item.riskAssessment);
  const actualIds = item.activities.map((activity) => activity.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    errors.push(`${label}.activities 与风险等级和触发因素不一致`);
  }
  item.activities.forEach((activity, index) => {
    const activityLabel = `${label}.activities[${index}]`;
    if (!assertObject(activity, activityLabel, errors)) return;
    if (!EXPECTED_ACTIVITY_STATUSES.includes(activity.status)) {
      errors.push(`${activityLabel}.status 无效`);
    }
    requireStringArray(activity.evidence, `${activityLabel}.evidence`, errors);
    if (activity.status === "已完成" && !(activity.evidence || []).length) {
      errors.push(`${activityLabel} 已完成时必须包含证据`);
    }
    if (activity.result !== null && !hasText(activity.result)) {
      errors.push(`${activityLabel}.result 必须为 null 或非空字符串`);
    }
  });
}

function validateEvidence(item, label, errors) {
  if (!Array.isArray(item.evidence)) {
    errors.push(`${label}.evidence 必须是数组`);
    return;
  }
  const ids = new Set();
  item.evidence.forEach((evidence, index) => {
    const evidenceLabel = `${label}.evidence[${index}]`;
    if (!assertObject(evidence, evidenceLabel, errors)) return;
    for (const field of ["id", "sourceType", "location", "originalClaim", "aiInterpretation", "scope", "confirmationStatus"]) {
      if (!hasText(evidence[field])) errors.push(`${evidenceLabel}.${field} 缺失`);
    }
    if (ids.has(evidence.id)) errors.push(`${evidenceLabel}.id 重复`);
    ids.add(evidence.id);
    if (!EXPECTED_EVIDENCE_SOURCE_TYPES.includes(evidence.sourceType)) {
      errors.push(`${evidenceLabel}.sourceType 无效`);
    }
    if (!EXPECTED_EVIDENCE_STATUSES.includes(evidence.confirmationStatus)) {
      errors.push(`${evidenceLabel}.confirmationStatus 无效`);
    }
    if (evidence.occurredAt !== null && !hasText(evidence.occurredAt)) {
      errors.push(`${evidenceLabel}.occurredAt 必须为 null 或非空字符串`);
    }
    if (evidence.confirmationStatus === "confirmed") {
      if (!hasText(evidence.confirmedBy)) errors.push(`${evidenceLabel}.confirmedBy 缺失`);
      if (!hasText(evidence.confirmedAt)) errors.push(`${evidenceLabel}.confirmedAt 缺失`);
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
      errors.push(`${artifactLabel}.supports 至少包含一个验收项或门禁`);
    }
  });
}

function validateReviewConfirmation(item, label, errors) {
  if (item.reviewConfirmation === null) return;
  const review = item.reviewConfirmation;
  if (!assertObject(review, `${label}.reviewConfirmation`, errors)) return;
  if (!["approved", "conditional", "rejected", "paused"].includes(review.outcome)) {
    errors.push(`${label}.reviewConfirmation.outcome 无效`);
  }
  if (typeof review.continueBuild !== "boolean") {
    errors.push(`${label}.reviewConfirmation.continueBuild 必须是布尔值`);
  }
  for (const field of [
    "confirmedScope",
    "excludedScope",
    "confirmedRules",
    "nonBlockingQuestions",
    "evidenceIds",
  ]) {
    requireStringArray(review[field], `${label}.reviewConfirmation.${field}`, errors);
  }
  if (!hasText(review.confirmedBy)) errors.push(`${label}.reviewConfirmation.confirmedBy 缺失`);
  if (!hasText(review.confirmedAt)) errors.push(`${label}.reviewConfirmation.confirmedAt 缺失`);
}

export function validateRegistryData(registry) {
  const errors = [];
  if (!assertObject(registry, "需求台账", errors)) return errors;
  if (registry.schemaVersion !== 3) errors.push("需求台账 schemaVersion 必须为 3");

  const stageIds = (registry.stageDefinitions || []).map((stage) => stage.id);
  if (JSON.stringify(stageIds) !== JSON.stringify(EXPECTED_STAGE_IDS)) {
    errors.push("流程阶段必须为 V0.3 五个主阶段并保持顺序");
  }
  (registry.stageDefinitions || []).forEach((stage, index) => {
    if (!assertObject(stage, `stageDefinitions[${index}]`, errors)) return;
    if (stage.label !== STAGE_LABELS[stage.id]) {
      errors.push(`stageDefinitions[${index}].label 与固定名称不一致`);
    }
    if (stage.required !== true) errors.push(`stageDefinitions[${index}].required 必须为 true`);
  });
  if (JSON.stringify(registry.activityStatuses) !== JSON.stringify(EXPECTED_ACTIVITY_STATUSES)) {
    errors.push("activityStatuses 与固定定义不一致");
  }

  const definitions = registry.taskControlDefinitions;
  if (!assertObject(definitions, "taskControlDefinitions", errors)) return errors;
  const expectedDefinitions = {
    executionStates: EXPECTED_EXECUTION_STATES,
    aiPolicies: EXPECTED_AI_POLICIES,
    readinessStatuses: EXPECTED_READINESS_STATUSES,
    waitingReasonCodes: EXPECTED_WAITING_REASON_CODES,
    artifactTypes: EXPECTED_ARTIFACT_TYPES,
    riskLevels: EXPECTED_RISK_LEVELS,
    riskTriggers: EXPECTED_RISK_TRIGGERS,
    evidenceSourceTypes: EXPECTED_EVIDENCE_SOURCE_TYPES,
    evidenceStatuses: EXPECTED_EVIDENCE_STATUSES,
  };
  for (const [field, expected] of Object.entries(expectedDefinitions)) {
    if (JSON.stringify(definitions[field]) !== JSON.stringify(expected)) {
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
    for (const field of ["pageIds", "actionIds", "stateIds", "documents"]) {
      requireStringArray(item[field], `${label}.${field}`, errors);
    }
    if (item.overallStatus !== undefined) {
      errors.push(`${label}.overallStatus 不得重复存储，应由阶段和执行状态派生`);
    }
    if (item.nodes !== undefined) {
      errors.push(`${label}.nodes 已由风险驱动 activities 替代`);
    }

    validateExecutionScope(item, label, errors);
    validateRisk(item, label, errors);
    validateActivities(item, label, errors);
    validateReadiness(item, label, errors);
    validateWaitingAndTerminalReasons(item, label, errors);
    validateEvidence(item, label, errors);
    validateArtifacts(item, label, errors);
    validateReviewConfirmation(item, label, errors);

    const readiness = deriveReadiness(item);
    if (["ready", "in-progress"].includes(item.executionState)) {
      if (!["planning-ready", "execution-ready"].includes(readiness)) {
        errors.push(`${item.id} 未满足就绪条件，不得进入 ${item.executionState}`);
      }
    }
    if (
      item.aiPolicy === "planning-only" &&
      item.currentStageId === "implementation" &&
      item.executionState === "in-progress"
    ) {
      errors.push(`${item.id} 仅授权规划，不得在实施阶段进行中`);
    }

    const stageIndex = EXPECTED_STAGE_IDS.indexOf(item.currentStageId);
    if (
      stageIndex < EXPECTED_STAGE_IDS.indexOf("implementation") &&
      [...(item.pageIds || []), ...(item.actionIds || []), ...(item.stateIds || [])].length
    ) {
      errors.push(`${item.id} 尚未进入实施阶段，不得预填 Page、Action 或 State ID`);
    }

    const activitiesBeforeReview = (item.activities || []).filter(
      (activity) => activity.id !== "product-review",
    );
    if (item.currentStageId === "awaiting-review") {
      if (activitiesBeforeReview.some((activity) => !["已完成", "已跳过"].includes(activity.status))) {
        errors.push(`${item.id} 进入待评审前必须完成或跳过全部实施活动`);
      }
    }

    if (item.currentStageId === "completed") {
      if (item.executionState !== "completed") {
        errors.push(`${item.id} 已完成阶段的 executionState 必须为 completed`);
      }
      if ((item.activities || []).some((activity) => !["已完成", "已跳过"].includes(activity.status))) {
        errors.push(`${item.id} 已完成时所有活动必须完成或有理由跳过`);
      }
      const productReview = (item.activities || []).find(
        (activity) => activity.id === "product-review",
      );
      if (productReview?.status !== "已完成") {
        errors.push(`${item.id} 已完成但产品评审活动未完成`);
      }
      if (!item.reviewConfirmation || !["approved", "conditional"].includes(item.reviewConfirmation.outcome)) {
        errors.push(`${item.id} 已完成但缺少有效产品评审确认`);
      }
      if (!(item.artifacts || []).some((artifact) => artifact.type === "user-confirmation")) {
        errors.push(`${item.id} 已完成但缺少 user-confirmation 产物`);
      }
      if (!(item.artifacts || []).some((artifact) => ["test-report", "review-report"].includes(artifact.type))) {
        errors.push(`${item.id} 已完成但缺少 test-report 或 review-report`);
      }
    } else if (item.executionState === "completed") {
      errors.push(`${item.id} executionState 为 completed 时主阶段也必须为 completed`);
    }
  });

  return errors;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderList(values, emptyText = "无") {
  if (!values?.length) return `- ${emptyText}`;
  return values.map((value) => `- ${value}`).join("\n");
}

export function renderRequirements(registry) {
  const items = registry.items || [];
  const lines = [
    "# 需求与变更台账",
    "",
    "<!-- 本文件由 docs/requirements/registry.json 确定性生成，请勿直接编辑。 -->",
    "",
    "## 1. 当前总览",
    "",
    `- 需求总数：${items.length}`,
    `- 实施中：${items.filter((item) => item.currentStageId === "implementation").length}`,
    `- 等待确认：${items.filter((item) => item.executionState === "waiting-human").length}`,
    `- 待评审：${items.filter((item) => item.currentStageId === "awaiting-review").length}`,
    `- 高风险：${items.filter((item) => item.riskAssessment?.confirmedLevel === "high").length}`,
    `- 已完成：${items.filter((item) => item.currentStageId === "completed").length}`,
    "",
  ];
  if (!items.length) {
    lines.push("当前没有已登记的增量需求。", "");
    return lines.join("\n");
  }

  lines.push(
    "| 编号 | 需求 | 风险 | 当前阶段 | 当前结论 | 责任人 | 下一步 |",
    "|---|---|---|---|---|---|---|",
  );
  for (const item of items) {
    const card = deriveStatusCard(item);
    lines.push(
      `| ${escapeCell(item.id)} | ${escapeCell(item.summary)} | ${escapeCell(item.riskAssessment?.confirmedLevel || "待评估")} | ${escapeCell(card.stage)} | ${escapeCell(card.verdict)} | ${escapeCell(card.owner)} | ${escapeCell(card.nextAction)} |`,
    );
  }
  lines.push("", "## 2. 单条需求详情", "");

  for (const item of items) {
    const card = deriveStatusCard(item);
    lines.push(
      `### ${item.id} ${item.summary}`,
      "",
      "#### 当前状态",
      "",
      `- 当前阶段：${card.stage}`,
      `- 当前结论：${card.verdict}`,
      `- 原因：${card.reason}`,
      `- 当前责任人：${card.owner}`,
      `- 下一步：${card.nextAction}`,
      "",
      "#### 本次范围",
      "",
      "##### 包含",
      "",
      renderList(item.executionScope?.included),
      "",
      "##### 明确不包含",
      "",
      renderList(item.executionScope?.excluded),
      "",
      "#### 风险判断",
      "",
      `- AI 建议：${item.riskAssessment?.recommendedLevel || "待评估"}`,
      `- 触发因素：${item.riskAssessment?.triggers?.join("、") || "待评估"}`,
      `- 产品确认：${item.riskAssessment?.confirmedLevel || "待确认"}`,
      `- 降级理由：${item.riskAssessment?.downgradeReason || "不适用"}`,
      "",
      "#### 活动进度",
      "",
      "| 活动 | 状态 | 结果或阻断原因 |",
      "|---|---|---|",
    );
    for (const activity of item.activities || []) {
      lines.push(
        `| ${escapeCell(ACTIVITY_LABELS[activity.id] || activity.id)} | ${escapeCell(activity.status)} | ${escapeCell(activity.result || "-")} |`,
      );
    }
    lines.push(
      "",
      "#### 验收与证据",
      "",
      `- 当前产物：${(item.artifacts || []).map((artifact) => artifact.location).join("、") || "无"}`,
      `- 遗留风险：${item.remainingRisks?.join("、") || "无"}`,
      `- 待确认问题：${item.openQuestions?.join("、") || "无"}`,
      "",
      "<details>",
      "<summary>详细任务控制</summary>",
      "",
      `- AI 策略：${item.aiPolicy}`,
      `- 执行状态：${item.executionState}`,
      `- 就绪结论：${deriveReadiness(item)}`,
      "",
      "</details>",
      "",
    );
  }
  return lines.join("\n");
}
