import { validateEvidencePolicy } from "../evidence-policy.mjs";
import {
  EXPECTED_STAGE_IDS,
  STAGE_LABELS,
  EXPECTED_ACTIVITY_STATUSES,
  EXPECTED_EXECUTION_STATES,
  EXPECTED_AI_POLICIES,
  EXPECTED_READINESS_CHECK_IDS,
  EXPECTED_READINESS_STATUSES,
  EXPECTED_WAITING_REASON_CODES,
  EXPECTED_ARTIFACT_TYPES,
  EXPECTED_RISK_LEVELS,
  EXPECTED_RISK_TRIGGERS,
  EXPECTED_EVIDENCE_SOURCE_TYPES,
  EXPECTED_EVIDENCE_STATUSES,
  ACTIVITY_LABELS,
  NON_SKIPPABLE_READINESS_IDS,
  DECISION_TRIGGERS,
  DOMAIN_TRIGGERS,
  EXCEPTION_TRIGGERS,
  SPECIALIST_TRIGGERS,
} from "./model.mjs";

export function hasAnyTrigger(triggers, expected) {
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

  const checks = new Map((item.readinessChecklist || []).map((check) => [check.id, check.status]));
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

export function firstIncompleteActivity(item) {
  return (item.activities || []).find(
    (activity) => !["已完成", "已跳过"].includes(activity.status),
  );
}

export function firstMissingReadiness(item) {
  return (item.readinessChecklist || []).find((check) =>
    ["not-assessed", "not-met"].includes(check.status),
  );
}

export const READINESS_LABELS = {
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
  const evidenceErrors = validateEvidencePolicy(item);
  if (
    ["ready", "in-progress", "completed"].includes(item.executionState) &&
    evidenceErrors.length
  ) {
    return {
      stage,
      verdict:
        item.executionState === "completed" ? "记录已完成，未按新规则验证" : "证据不足，暂不能实施",
      reason: evidenceErrors[0].startsWith("acceptance-testable 证据未确认或引用不存在：")
        ? "找不到验收标准的确认依据。"
        : evidenceErrors[0],
      owner: "产品经理",
      nextAction: evidenceErrors[0].startsWith("acceptance-testable 证据未确认或引用不存在：")
        ? "请提供产品经理确认该标准的记录；若已有记录，由 AI 修正关联后重新检查。"
        : "补齐引用和验收依据后重新检查；保留原记录状态",
    };
  }
  if (item.currentStageId === "completed" && item.executionState === "completed") {
    return {
      stage,
      verdict: "已记录完成，交付前需核验",
      reason: "已登记产品评审引用；状态卡不替代证据文件与报告的实时检查",
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

  if (item.executionState === "locked")
    return {
      stage,
      verdict: "已锁定",
      reason: "尚未解锁，满足就绪条件不等于允许启动",
      owner: "产品经理",
      nextAction: "核对授权和锁定原因后决定是否解锁",
    };
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
    verdict: "实施条件已登记，待实时核验",
    reason: "授权和就绪引用已登记；核验证据文件有效性后才能启动",
    owner: "AI",
    nextAction: nextActivity
      ? `先运行当前项目检查，再执行${ACTIVITY_LABELS[nextActivity.id] || nextActivity.id}`
      : "将需求提交产品评审",
  };
}
