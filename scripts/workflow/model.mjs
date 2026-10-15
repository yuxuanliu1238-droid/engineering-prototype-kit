export const EXPECTED_STAGE_IDS = [
  "recorded",
  "analysis-confirmation",
  "implementation",
  "awaiting-review",
  "completed",
];

export const REQUIREMENT_LIFECYCLE_STAGE_IDS = [
  "recorded", "analysis-confirmation", "awaiting-authorization",
  "implementation", "awaiting-review", "completed",
];

export const STAGE_LABELS = {
  recorded: "已记录",
  "analysis-confirmation": "分析确认",
  "awaiting-authorization": "待实施授权",
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
  "business-rule-check": "规则用例核对",
  "state-data-check": "状态与数据核对",
  "integration-check": "接口兼容核对",
  "document-check": "文档一致性核对",
  "backend-impact-check": "后台影响核对",
};

// Main type describes the problem to solve; impact tags select additional deliverables.
// This catalog is shared by every Kit-generated project, not tied to CX.
export const REQUIREMENT_TYPES = {
  "frontend-feature": {
    label: "新增用户能力", focus: "以前做不到的新用户操作", check: "page-check",
    ask: ["谁使用新能力", "哪些业务条件允许使用", "成功与失败结果"],
    analyze: ["用户任务路径", "入口与权限", "原有能力的关联"],
    outputs: ["能力方案", "交互路径", "验收场景"],
  },
  "existing-page-adjustment": {
    label: "现有页面调整", focus: "已有能力的呈现或交互", check: "page-check",
    ask: ["是否改变原有业务含义", "是否删除仍在使用的入口"],
    analyze: ["现有页面与字段", "调整前后差异", "原有任务路径"],
    outputs: ["页面调整说明", "前后对照", "回归检查"],
  },
  "business-rule-validation": {
    label: "业务规则与校验调整", focus: "判断条件与异常结果", check: "business-rule-check",
    ask: ["生效条件", "例外与拒绝结果", "历史业务如何处理"],
    analyze: ["规则边界", "正反例", "受影响操作"],
    outputs: ["规则定义", "判断表", "核对用例"],
  },
  "state-data-definition": {
    label: "状态与数据口径调整", focus: "状态流转与数据计算口径", check: "state-data-check",
    ask: ["状态进入与退出条件", "历史数据口径", "谁可更改状态"],
    analyze: ["状态路径", "数据来源", "统计与历史影响"],
    outputs: ["状态或口径定义", "样例核对", "迁移影响说明"],
  },
  "interface-integration": {
    label: "接口与对接变更", focus: "调用、字段与兼容关系", check: "integration-check",
    ask: ["对接双方责任", "字段业务含义", "失败与重试边界"],
    analyze: ["调用方向", "字段映射", "兼容性与异常"],
    outputs: ["接口变更说明", "字段映射", "联调场景"],
  },
  "document-workflow-governance": {
    label: "文档与工作流治理", focus: "说明或协作规则本身", check: "document-check",
    ask: ["哪份说明是权威来源", "谁负责确认"],
    analyze: ["现有版本", "引用关系", "流程影响"],
    outputs: ["修订说明", "引用更新", "一致性检查"],
  },
};

export const IMPACT_TAGS = {
  "frontend-page": { label: "前端页面", activities: ["page-contract", "interactive-prototype", "page-check"], outputs:["页面影响说明","交互原型与页面契约"] },
  "backend-logic": { label: "后台业务逻辑", activities: ["backend-impact-check"], outputs:["后台逻辑影响说明"] },
  "state-data": { label: "状态与数据", activities: ["state-data-check"], outputs:["状态与数据影响说明"] },
  "external-interface": { label: "外部接口", activities: ["integration-check"], outputs:["接口字段与兼容影响说明"] },
  "requirement-document": { label: "需求文档", activities: ["document-check"], outputs:["产品需求说明"] },
};

export const REQUIREMENT_TEMPLATE_VERSION = 1;
export function buildRequirementTemplateSnapshot(requirementType, impactTags = []) {
  const profile=REQUIREMENT_TYPES[requirementType];
  if(!profile||!Array.isArray(impactTags)||impactTags.some(tag=>!IMPACT_TAGS[tag]))
    throw new Error("INVALID_REQUIREMENT_TEMPLATE");
  const branches=[...new Set(impactTags)].map(id=>({id,label:IMPACT_TAGS[id].label,
    activities:[...IMPACT_TAGS[id].activities],outputs:[...IMPACT_TAGS[id].outputs]}));
  return {version:REQUIREMENT_TEMPLATE_VERSION,requirementType,label:profile.label,focus:profile.focus,
    deliveryMode:["frontend-feature","existing-page-adjustment"].includes(requirementType)?"prototype":"strategy-artifact",
    questions:{ask:[...profile.ask],recommend:["有业务影响且存在明确推荐方案的选择"],
      aiDecides:["不改变业务结果的常规设计与工程细节"]},
    analyze:[...profile.analyze],outputs:[...new Set([...profile.outputs,...branches.flatMap(item=>item.outputs)])],
    impactBranches:branches,
    authorization:{requiresSeparateConfirmation:true,excludes:["正式生产开发、部署与发布","未确认的其他需求","未列明的跨项目修改"]},
    acceptance:[`核心验收围绕“${profile.focus}”且可独立复核`,"影响标签触发的交付支线与主方案使用同一业务口径","未修改授权范围之外的项目内容"],
    documentStructure:["目标与范围","业务规则与示例","影响支线","验收要点","待确认事项"],
    evidence:["原始需求与材料依据","业务方案确认","单独实施授权","交付物与检查结果","产品经理最终验收"],
    splitRule:"只有组成部分能够独立实施、独立回滚并独立验收时，才建议拆分需求。"};
}

export const CLASSIFICATION_PRIORITY = [
  "state-data-definition", "interface-integration", "business-rule-validation",
  "frontend-feature", "existing-page-adjustment", "document-workflow-governance",
];

// Candidate causes must be explained by the analyst; title keywords alone are not evidence.
export function recommendMainType(causes) {
  if (!Array.isArray(causes)) throw new TypeError("causes 必须是数组");
  const essential = causes.filter(cause => cause?.essential === true);
  const ranked = essential.filter(cause => CLASSIFICATION_PRIORITY.includes(cause.type));
  if (!ranked.length) return null;
  ranked.sort((a, b) => CLASSIFICATION_PRIORITY.indexOf(a.type) - CLASSIFICATION_PRIORITY.indexOf(b.type));
  const winner = ranked[0];
  if (typeof winner.reason !== "string" || !winner.reason.trim()) return null;
  return { type: winner.type, reason: winner.reason.trim(), alternatives: ranked.slice(1).map(cause => cause.type) };
}

export function shouldSuggestSplit(parts) {
  if (!Array.isArray(parts) || parts.length < 2) return false;
  return parts.every(part => part?.independentlyImplemented === true &&
    part?.independentlyRolledBack === true && part?.independentlyAccepted === true);
}

export function validateAITypeRecommendation(result) {
  if(!result||!Array.isArray(result.causes)||result.causes.length<1||result.causes.length>6||
    !Array.isArray(result.impactTags)||result.impactTags.some(tag=>!IMPACT_TAGS[tag])||
    new Set(result.impactTags).size!==result.impactTags.length||
    !Array.isArray(result.parts)||result.parts.length>8)throw new Error("INVALID_TYPE_RECOMMENDATION");
  for(const cause of result.causes){
    if(!REQUIREMENT_TYPES[cause?.type]||typeof cause.essential!=="boolean"||
      typeof cause.reason!=="string"||cause.reason.trim().length<3||cause.reason.length>1000)
      throw new Error("INVALID_TYPE_RECOMMENDATION");
  }
  if(new Set(result.causes.map(cause=>cause.type)).size!==result.causes.length)
    throw new Error("INVALID_TYPE_RECOMMENDATION");
  for(const part of result.parts){
    if(typeof part?.name!=="string"||!part.name.trim()||
      ["independentlyImplemented","independentlyRolledBack","independentlyAccepted"].some(key=>typeof part[key]!=="boolean"))
      throw new Error("INVALID_TYPE_RECOMMENDATION");
  }
  const main=recommendMainType(result.causes);
  if(!main||main.type==="existing-page-adjustment"&&!result.impactTags.includes("frontend-page"))
    throw new Error("INVALID_TYPE_RECOMMENDATION");
  return {mainType:main.type,reason:main.reason,alternatives:main.alternatives,
    impactTags:[...result.impactTags],suggestSplit:shouldSuggestSplit(result.parts),parts:result.parts};
}

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
