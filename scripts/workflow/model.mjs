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
  implementation: "实施阶段",
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

export const EXPECTED_READINESS_STATUSES = ["not-assessed", "met", "not-met", "not-applicable"];

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

export const EXPECTED_EVIDENCE_STATUSES = ["candidate", "confirmed", "rejected", "legacy"];

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

export const NON_SKIPPABLE_READINESS_IDS = new Set([
  "goal-clear",
  "scope-clear",
  "acceptance-testable",
  "authorization-confirmed",
  "risk-reviewed",
]);

export const DECISION_TRIGGERS = new Set(["product-outcome", "prohibited-restoration"]);
export const DOMAIN_TRIGGERS = new Set(["lifecycle", "role-responsibility"]);
export const EXCEPTION_TRIGGERS = new Set(["failure-recovery", "external-system", "batch-async"]);
export const SPECIALIST_TRIGGERS = new Set([
  "permissions",
  "data-scope",
  "money",
  "destructive",
  "sensitive-data",
  "security",
]);
