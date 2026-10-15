import {
  EXPECTED_STAGE_IDS,
  REQUIREMENT_LIFECYCLE_STAGE_IDS,
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
  REQUIREMENT_TYPES,
  IMPACT_TAGS,
  REQUIREMENT_TEMPLATE_VERSION,
} from "./model.mjs";
import { buildActivityIds, deriveReadiness } from "./policy.mjs";
import { assertObject, hasText, requireStringArray } from "../project-lib.mjs";
import { validateEvidencePolicy } from "../evidence-policy.mjs";

export function validateWaitingAndTerminalReasons(item, label, errors) {
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

export function validateReadiness(item, label, errors) {
  if (!Array.isArray(item.readinessChecklist)) {
    errors.push(`${label}.readinessChecklist 必须是数组`);
    return;
  }
  const ids = item.readinessChecklist.map((check) => check?.id);
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

export function validateExecutionScope(item, label, errors) {
  if (!assertObject(item.executionScope, `${label}.executionScope`, errors)) return;
  if (!hasText(item.executionScope.objective)) {
    errors.push(`${label}.executionScope.objective 缺失`);
  }
  for (const field of ["included", "excluded", "deferred"]) {
    requireStringArray(item.executionScope[field], `${label}.executionScope.${field}`, errors);
  }
}

export function validateRisk(item, label, errors) {
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

export function validateActivities(item, label, errors) {
  if (!Array.isArray(item.activities)) {
    errors.push(`${label}.activities 必须是数组`);
    return;
  }
  const expectedIds = buildActivityIds(item.riskAssessment, item.requirementType, item.impactTags);
  const actualIds = item.activities.map((activity) => activity?.id);
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
    if (
      activity.status === "已跳过" &&
      (activity.id === "product-review" ||
        !hasText(activity.skipReason) ||
        !hasText(activity.skipConfirmationRef))
    ) {
      errors.push(`${activityLabel} 跳过必须有理由和确认引用，产品评审不可跳过`);
    }
    if (activity.result !== null && !hasText(activity.result)) {
      errors.push(`${activityLabel}.result 必须为 null 或非空字符串`);
    }
  });
}

export function validateEvidence(item, label, errors) {
  if (!Array.isArray(item.evidence)) {
    errors.push(`${label}.evidence 必须是数组`);
    return;
  }
  const ids = new Set();
  item.evidence.forEach((evidence, index) => {
    const evidenceLabel = `${label}.evidence[${index}]`;
    if (!assertObject(evidence, evidenceLabel, errors)) return;
    for (const field of [
      "id",
      "sourceType",
      "location",
      "originalClaim",
      "aiInterpretation",
      "scope",
      "confirmationStatus",
    ]) {
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

export function validateArtifacts(item, label, errors) {
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

export function validateReviewConfirmation(item, label, errors) {
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

export function validateRegistryShape(registry) {
  const errors = [];
  if (!assertObject(registry, "需求台账", errors)) return errors;
  if (registry.schemaVersion !== 3) errors.push("需求台账 schemaVersion 必须为 3");

  const stageIds = (registry.stageDefinitions || []).map((stage) => stage?.id);
  const acceptedStages=[EXPECTED_STAGE_IDS,REQUIREMENT_LIFECYCLE_STAGE_IDS];
  if (!acceptedStages.some(ids=>JSON.stringify(stageIds)===JSON.stringify(ids))) {
    errors.push("流程阶段必须为兼容的五阶段或需求执行六阶段，并保持顺序");
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
    if (!stageIds.includes(item.currentStageId)) {
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
    if (item.requirementType !== undefined) {
      if (!REQUIREMENT_TYPES[item.requirementType]) errors.push(`${label}.requirementType 无效`);
      requireStringArray(item.impactTags, `${label}.impactTags`, errors);
      for (const tag of item.impactTags || []) {
        if (!IMPACT_TAGS[tag]) errors.push(`${label}.impactTags 包含无效标签：${tag}`);
      }
      if (new Set(item.impactTags || []).size !== (item.impactTags || []).length) {
        errors.push(`${label}.impactTags 不得重复`);
      }
      if(item.workbenchTemplate!==undefined){
        const template=item.workbenchTemplate;
        if(assertObject(template,`${label}.workbenchTemplate`,errors)){
          if(template.version!==REQUIREMENT_TEMPLATE_VERSION)errors.push(`${label}.workbenchTemplate.version 无效`);
          if(template.requirementType!==item.requirementType)errors.push(`${label}.workbenchTemplate 与主类型不一致`);
          for(const field of ["analyze","outputs","acceptance","documentStructure","evidence"])
            requireStringArray(template[field],`${label}.workbenchTemplate.${field}`,errors);
          if(assertObject(template.questions,`${label}.workbenchTemplate.questions`,errors))
            for(const field of ["ask","recommend","aiDecides"])
              requireStringArray(template.questions[field],`${label}.workbenchTemplate.questions.${field}`,errors);
          if(!Array.isArray(template.impactBranches)||template.impactBranches.some(branch=>!item.impactTags.includes(branch?.id)))
            errors.push(`${label}.workbenchTemplate.impactBranches 与影响标签不一致`);
        }
      }
      if (item.requirementType==="existing-page-adjustment" &&
        !item.impactTags?.includes("frontend-page")) {
        errors.push(`${label} 现有页面调整必须标记前端页面影响`);
      }
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
    if(item.workbenchLifecycle!==undefined){
      const lifecycle=item.workbenchLifecycle,states=new Set(["awaiting-analysis","awaiting-plan","awaiting-authorization","executing","awaiting-review","completed"]),
        activities=new Set(["idle","submitted","running","blocked"]);
      if(!assertObject(lifecycle,`${label}.workbenchLifecycle`,errors))return;
      if(!states.has(lifecycle.state))errors.push(`${label}.workbenchLifecycle.state 无效`);
      if(!activities.has(lifecycle.activity))errors.push(`${label}.workbenchLifecycle.activity 无效`);
      if(!hasText(lifecycle.updatedAt)||Number.isNaN(Date.parse(lifecycle.updatedAt)))errors.push(`${label}.workbenchLifecycle.updatedAt 无效`);
      if(!Array.isArray(lifecycle.history)||!lifecycle.history.length)errors.push(`${label}.workbenchLifecycle.history 缺失`);
      else{
        lifecycle.history.forEach((entry,historyIndex)=>{
          if(!entry||!states.has(entry.state)||!activities.has(entry.activity)||!hasText(entry.actor)||!hasText(entry.event)||Number.isNaN(Date.parse(entry.at)))
            errors.push(`${label}.workbenchLifecycle.history[${historyIndex}] 无效`);
        });
        if(lifecycle.history.at(-1)?.state!==lifecycle.state||lifecycle.history.at(-1)?.activity!==lifecycle.activity)
          errors.push(`${label}.workbenchLifecycle 当前状态与历史末项不一致`);
      }
    }

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

    const stageIndex = stageIds.indexOf(item.currentStageId);
    if (stageIds.length===REQUIREMENT_LIFECYCLE_STAGE_IDS.length &&
      stageIndex>=stageIds.indexOf("implementation") &&
      item.executionState!=="cancelled" &&
      item.readinessChecklist?.find(check=>check.id==="authorization-confirmed")?.status!=="met") {
      errors.push(`${item.id} 未记录单独实施授权，不得进入执行或验收阶段`);
    }
    if (
      stageIndex < stageIds.indexOf("implementation") &&
      [...(item.pageIds || []), ...(item.actionIds || []), ...(item.stateIds || [])].length
    ) {
      errors.push(`${item.id} 尚未进入实施阶段，不得预填 Page、Action 或 State ID`);
    }

    const activitiesBeforeReview = (item.activities || []).filter(
      (activity) => activity.id !== "product-review",
    );
    if (item.currentStageId === "awaiting-review") {
      if (
        activitiesBeforeReview.some((activity) => !["已完成", "已跳过"].includes(activity.status))
      ) {
        errors.push(`${item.id} 进入待评审前必须完成或跳过全部实施活动`);
      }
    }

    if (item.currentStageId === "completed") {
      if (item.executionState !== "completed") {
        errors.push(`${item.id} 已完成阶段的 executionState 必须为 completed`);
      }
      if (
        (item.activities || []).some((activity) => !["已完成", "已跳过"].includes(activity.status))
      ) {
        errors.push(`${item.id} 已完成时所有活动必须完成或有理由跳过`);
      }
      const productReview = (item.activities || []).find(
        (activity) => activity.id === "product-review",
      );
      if (productReview?.status !== "已完成") {
        errors.push(`${item.id} 已完成但产品评审活动未完成`);
      }
      if (
        !item.reviewConfirmation ||
        !["approved", "conditional"].includes(item.reviewConfirmation.outcome)
      ) {
        errors.push(`${item.id} 已完成但缺少有效产品评审确认`);
      }
      if (!(item.artifacts || []).some((artifact) => artifact.type === "user-confirmation")) {
        errors.push(`${item.id} 已完成但缺少 user-confirmation 产物`);
      }
      if (
        !(item.artifacts || []).some((artifact) =>
          ["test-report", "review-report"].includes(artifact.type),
        )
      ) {
        errors.push(`${item.id} 已完成但缺少 test-report 或 review-report`);
      }
    } else if (item.executionState === "completed") {
      errors.push(`${item.id} executionState 为 completed 时主阶段也必须为 completed`);
    }
  });

  return errors;
}

export function validateRegistryData(registry, { strict = false } = {}) {
  try {
    const errors = validateRegistryShape(registry);
    if (strict && Array.isArray(registry?.items))
      for (const item of registry.items)
        if (item && typeof item === "object") errors.push(...validateEvidencePolicy(item));
    return errors;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return [`输入结构错误：数组或成员类型不合法（${error.message}）`];
  }
}
