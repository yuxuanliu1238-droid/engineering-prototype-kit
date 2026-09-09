import {
  HANDOFF_STATUSES,
  TASK_TYPES,
  MATERIAL_TYPES,
  MATERIAL_ROLES,
  BASELINE_STATES,
  ENGINEERING_DOMAINS,
  INTEGRATION_DIRECTIONS,
  SCOPE_DISPOSITIONS,
  TOUCHPOINT_DISPOSITIONS,
  CONFIRMATION_DECISIONS,
  CHANGE_TYPES,
  DISALLOWED_TASK_FIELDS,
  SECRET_PATTERNS,
  unique,
  asArray,
  isObject,
} from "./model.mjs";
import { analyzeHandoffCoverage } from "./coverage.mjs";
import { assertObject, hasText, requireStringArray } from "../project-lib.mjs";

export function requireNullableText(value, label, errors) {
  if (value !== null && !hasText(value)) errors.push(`${label} 必须为 null 或非空字符串`);
}

export function validateIds(items, label, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${label} 必须是数组`);
    return new Set();
  }
  const ids = new Set();
  items.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;
    if (!assertObject(item, itemLabel, errors)) return;
    if (!hasText(item.id)) errors.push(`${itemLabel}.id 缺失`);
    else if (ids.has(item.id)) errors.push(`${itemLabel}.id 重复：${item.id}`);
    else ids.add(item.id);
  });
  return ids;
}

export function validateReferences(values, validIds, label, errors) {
  if (!requireStringArray(values, label, errors)) return;
  for (const value of values) {
    if (!validIds.has(value)) errors.push(`${label} 引用了不存在的 ID：${value}`);
  }
}

export function validateScopeItem(item, label, dispositions, errors) {
  if (!dispositions.includes(item.disposition)) errors.push(`${label}.disposition 无效`);
  if (item.disposition !== "development-required" && !hasText(item.reason)) {
    errors.push(`${label} 标记为 ${item.disposition} 时必须说明理由`);
  }
  if (item.reason !== null && item.reason !== undefined && !hasText(item.reason)) {
    errors.push(`${label}.reason 必须为 null 或非空字符串`);
  }
}

export function validateConfirmation(confirmation, label, materialIds, errors) {
  if (!assertObject(confirmation, label, errors)) return;
  if (!CONFIRMATION_DECISIONS.includes(confirmation.decision))
    errors.push(`${label}.decision 无效`);
  validateReferences(confirmation.evidenceRefIds, materialIds, `${label}.evidenceRefIds`, errors);
  if (confirmation.decision !== "pending") {
    if (!hasText(confirmation.confirmedBy)) errors.push(`${label}.confirmedBy 缺失`);
    if (!hasText(confirmation.confirmedAt)) errors.push(`${label}.confirmedAt 缺失`);
    if (!Array.isArray(confirmation.evidenceRefIds) || confirmation.evidenceRefIds.length === 0) {
      errors.push(`${label}.evidenceRefIds 确认后至少包含一项证据`);
    }
  }
}

export function validateMaterial(material, label, errors) {
  if (!MATERIAL_TYPES.includes(material.type)) errors.push(`${label}.type 无效`);
  if (!MATERIAL_ROLES.includes(material.role)) errors.push(`${label}.role 无效`);
  if (!hasText(material.title)) errors.push(`${label}.title 缺失`);
  if (!hasText(material.locator)) errors.push(`${label}.locator 缺失`);
  requireNullableText(material.section, `${label}.section`, errors);
  if (!BASELINE_STATES.includes(material.baselineState)) errors.push(`${label}.baselineState 无效`);
  requireNullableText(material.revisionLabel, `${label}.revisionLabel`, errors);
  if (!hasText(material.reviewedAt)) errors.push(`${label}.reviewedAt 缺失`);
  if (material.baselineState === "verified" && !hasText(material.revisionLabel)) {
    errors.push(`${label} 已自动核对时必须记录 revisionLabel`);
  }
  if (material.baselineState === "manual-confirmed") {
    if (!hasText(material.confirmedBy)) errors.push(`${label}.confirmedBy 缺失`);
    if (!hasText(material.confirmedAt)) errors.push(`${label}.confirmedAt 缺失`);
  }
}

export function validateMaterialLinks(links, label, materialIds, errors) {
  if (!Array.isArray(links) || links.length === 0) {
    errors.push(`${label} 至少包含一个材料引用`);
    return;
  }
  links.forEach((link, index) => {
    const linkLabel = `${label}[${index}]`;
    if (!assertObject(link, linkLabel, errors)) return;
    if (!hasText(link.materialId)) errors.push(`${linkLabel}.materialId 缺失`);
    else if (!materialIds.has(link.materialId))
      errors.push(`${linkLabel}.materialId 不存在：${link.materialId}`);
    requireNullableText(link.section, `${linkLabel}.section`, errors);
  });
}

export function validateTechnicalBasis(basis, label, materialIds, errors) {
  if (basis === null || basis === undefined) return false;
  if (!assertObject(basis, label, errors)) return false;
  if (!hasText(basis.summary)) errors.push(`${label}.summary 缺失`);
  validateReferences(basis.materialRefIds, materialIds, `${label}.materialRefIds`, errors);
  if (!hasText(basis.confirmedBy)) errors.push(`${label}.confirmedBy 缺失`);
  if (!hasText(basis.confirmedAt)) errors.push(`${label}.confirmedAt 缺失`);
  return true;
}

export function validateTask(task, label, context, errors) {
  for (const field of DISALLOWED_TASK_FIELDS) {
    if (Object.hasOwn(task, field))
      errors.push(`${label}.${field} 不属于开发范围清单，请在研发进度工具中维护`);
  }
  if (!hasText(task.title)) errors.push(`${label}.title 缺失`);
  if (!TASK_TYPES.includes(task.type)) errors.push(`${label}.type 无效`);
  if (!hasText(task.developmentScope)) errors.push(`${label}.developmentScope 缺失`);
  if (!Array.isArray(task.engineeringDomains) || task.engineeringDomains.length === 0) {
    errors.push(`${label}.engineeringDomains 至少包含一个研发端`);
  } else {
    for (const domain of task.engineeringDomains) {
      if (!ENGINEERING_DOMAINS.includes(domain))
        errors.push(`${label}.engineeringDomains 包含无效值：${domain}`);
    }
  }
  validateReferences(
    task.requirementIds,
    context.requirementIds,
    `${label}.requirementIds`,
    errors,
  );
  for (const requirementId of asArray(task.requirementIds)) {
    if (context.requirementDispositions.get(requirementId) === "no-development") {
      errors.push(`${label}.requirementIds 不得引用已标记无需研发改动的需求：${requirementId}`);
    }
  }
  const hasTechnicalBasis = validateTechnicalBasis(
    task.technicalBasis,
    `${label}.technicalBasis`,
    context.materialIds,
    errors,
  );
  if (
    Array.isArray(task.requirementIds) &&
    task.requirementIds.length === 0 &&
    !hasTechnicalBasis
  ) {
    errors.push(`${label} 必须关联需求，或提供研发确认的 technicalBasis`);
  }
  if (
    !requireStringArray(task.acceptanceCriteria, `${label}.acceptanceCriteria`, errors) ||
    task.acceptanceCriteria.length === 0
  ) {
    errors.push(`${label}.acceptanceCriteria 至少包含一项`);
  }
  requireStringArray(task.prerequisites, `${label}.prerequisites`, errors);
  if (
    !requireStringArray(task.reviewBasis, `${label}.reviewBasis`, errors) ||
    task.reviewBasis.length === 0
  ) {
    errors.push(`${label}.reviewBasis 至少包含一项研发评审依据`);
  }
  validateMaterialLinks(task.materialRefs, `${label}.materialRefs`, context.materialIds, errors);
  if (!requireStringArray(task.scopeItemIds, `${label}.scopeItemIds`, errors)) return;

  if (task.type === "application-feature") {
    if (!assertObject(task.application, `${label}.application`, errors)) return;
    if (task.integration !== undefined || task.nonPage !== undefined)
      errors.push(`${label} 应用功能任务不得混入其他类型结构`);
    if (!hasText(task.application.application))
      errors.push(`${label}.application.application 缺失`);
    if (
      !requireStringArray(task.application.menuPath, `${label}.application.menuPath`, errors) ||
      task.application.menuPath.length === 0
    ) {
      errors.push(`${label}.application.menuPath 至少包含一级菜单`);
    }
    if (!hasText(task.application.page)) errors.push(`${label}.application.page 缺失`);
    if (!hasText(task.application.operation)) errors.push(`${label}.application.operation 缺失`);
    validateReferences(
      task.scopeItemIds,
      context.applicationScopeIds,
      `${label}.scopeItemIds`,
      errors,
    );
    if (task.scopeItemIds.length === 0)
      errors.push(`${label}.scopeItemIds 应用功能任务至少关联一个已声明触点`);
    for (const scopeItemId of task.scopeItemIds) {
      if (context.applicationDispositions.get(scopeItemId) === "no-change") {
        errors.push(`${label}.scopeItemIds 不得引用已标记本次不改的应用触点：${scopeItemId}`);
      }
    }
  } else if (task.type === "external-integration") {
    if (!assertObject(task.integration, `${label}.integration`, errors)) return;
    if (task.application !== undefined || task.nonPage !== undefined)
      errors.push(`${label} 外部系统接口任务不得混入其他类型结构`);
    if (!hasText(task.integration.systemParty))
      errors.push(`${label}.integration.systemParty 缺失`);
    if (!hasText(task.integration.interfaceName))
      errors.push(`${label}.integration.interfaceName 缺失`);
    if (!INTEGRATION_DIRECTIONS.includes(task.integration.direction))
      errors.push(`${label}.integration.direction 无效`);
    if (!hasText(task.integration.triggerScenario))
      errors.push(`${label}.integration.triggerScenario 缺失`);
    validateReferences(
      task.scopeItemIds,
      context.integrationScopeIds,
      `${label}.scopeItemIds`,
      errors,
    );
    if (task.scopeItemIds.length === 0)
      errors.push(`${label}.scopeItemIds 外部系统接口任务至少关联一个已声明接口`);
    for (const scopeItemId of task.scopeItemIds) {
      if (context.integrationDispositions.get(scopeItemId) === "no-change") {
        errors.push(`${label}.scopeItemIds 不得引用已标记本次不改的接口：${scopeItemId}`);
      }
    }
  } else if (task.type === "non-page") {
    if (!assertObject(task.nonPage, `${label}.nonPage`, errors)) return;
    if (task.application !== undefined || task.integration !== undefined)
      errors.push(`${label} 非页面任务不得混入其他类型结构`);
    if (!hasText(task.nonPage.category)) errors.push(`${label}.nonPage.category 缺失`);
    if (!hasText(task.nonPage.triggerScenario))
      errors.push(`${label}.nonPage.triggerScenario 缺失`);
    if (task.scopeItemIds.length !== 0) errors.push(`${label}.scopeItemIds 非页面任务必须为空数组`);
  }
}

export function validateDevelopmentHandoff(data) {
  const errors = [];
  if (!assertObject(data, "研发任务清单", errors)) return errors;
  if (data.schemaVersion !== 1) errors.push("schemaVersion 必须为 1");
  if (!hasText(data.listId)) errors.push("listId 缺失");
  if (!hasText(data.title)) errors.push("title 缺失");
  if (!/^V\d+\.\d+$/.test(data.version || ""))
    errors.push("version 必须使用 V主版本.次版本，例如 V1.0");
  if (!HANDOFF_STATUSES.includes(data.status)) errors.push("status 无效");
  requireNullableText(data.supersededBy, "supersededBy", errors);
  if (data.status === "superseded" && !hasText(data.supersededBy))
    errors.push("superseded 状态必须记录 supersededBy");

  const materialIds = validateIds(data.materials, "materials", errors);
  for (const [index, material] of asArray(data.materials).entries()) {
    if (isObject(material)) validateMaterial(material, `materials[${index}]`, errors);
  }

  if (!assertObject(data.handoffScope, "handoffScope", errors)) return errors;
  if (!hasText(data.handoffScope.summary)) errors.push("handoffScope.summary 缺失");
  const requirementIds = validateIds(
    data.handoffScope.requirements,
    "handoffScope.requirements",
    errors,
  );
  const requirementDispositions = new Map();
  for (const [index, requirement] of asArray(data.handoffScope.requirements).entries()) {
    const label = `handoffScope.requirements[${index}]`;
    if (!isObject(requirement)) continue;
    requirementDispositions.set(requirement.id, requirement.disposition);
    if (!hasText(requirement.title)) errors.push(`${label}.title 缺失`);
    validateScopeItem(requirement, label, SCOPE_DISPOSITIONS, errors);
    validateReferences(requirement.materialRefIds, materialIds, `${label}.materialRefIds`, errors);
  }

  const applicationScopeIds = validateIds(
    data.handoffScope.applicationItems,
    "handoffScope.applicationItems",
    errors,
  );
  const applicationDispositions = new Map();
  for (const [index, item] of asArray(data.handoffScope.applicationItems).entries()) {
    const label = `handoffScope.applicationItems[${index}]`;
    if (!isObject(item)) continue;
    applicationDispositions.set(item.id, item.disposition);
    if (!hasText(item.application)) errors.push(`${label}.application 缺失`);
    if (
      !requireStringArray(item.menuPath, `${label}.menuPath`, errors) ||
      item.menuPath.length === 0
    ) {
      errors.push(`${label}.menuPath 至少包含一级菜单`);
    }
    if (!hasText(item.page)) errors.push(`${label}.page 缺失`);
    if (!hasText(item.operation)) errors.push(`${label}.operation 缺失`);
    validateScopeItem(item, label, TOUCHPOINT_DISPOSITIONS, errors);
  }

  const integrationScopeIds = validateIds(
    data.handoffScope.integrationItems,
    "handoffScope.integrationItems",
    errors,
  );
  const integrationDispositions = new Map();
  for (const [index, item] of asArray(data.handoffScope.integrationItems).entries()) {
    const label = `handoffScope.integrationItems[${index}]`;
    if (!isObject(item)) continue;
    integrationDispositions.set(item.id, item.disposition);
    if (!hasText(item.systemParty)) errors.push(`${label}.systemParty 缺失`);
    if (!hasText(item.interfaceName)) errors.push(`${label}.interfaceName 缺失`);
    validateScopeItem(item, label, TOUCHPOINT_DISPOSITIONS, errors);
  }

  if (!assertObject(data.confirmations, "confirmations", errors)) return errors;
  validateConfirmation(data.confirmations.product, "confirmations.product", materialIds, errors);
  validateConfirmation(
    data.confirmations.engineering,
    "confirmations.engineering",
    materialIds,
    errors,
  );

  if (!assertObject(data.currentRevision, "currentRevision", errors)) return errors;
  if (!CHANGE_TYPES.includes(data.currentRevision.changeType))
    errors.push("currentRevision.changeType 无效");
  if (!hasText(data.currentRevision.summary)) errors.push("currentRevision.summary 缺失");
  if (typeof data.currentRevision.businessScopeChanged !== "boolean")
    errors.push("currentRevision.businessScopeChanged 必须是布尔值");
  requireStringArray(data.currentRevision.relatedCrIds, "currentRevision.relatedCrIds", errors);
  if (data.currentRevision.changeType === "business-scope-change") {
    if (data.currentRevision.businessScopeChanged !== true)
      errors.push("业务范围变化版本必须将 businessScopeChanged 设为 true");
    if (!(data.currentRevision.relatedCrIds || []).length)
      errors.push("业务范围变化版本必须关联重新评审的 CR");
  } else if (data.currentRevision.businessScopeChanged !== false) {
    errors.push(`${data.currentRevision.changeType} 不得标记为业务范围变化`);
  }

  if (!Array.isArray(data.versionHistory) || data.versionHistory.length === 0) {
    errors.push("versionHistory 至少包含当前版本");
  } else {
    const versionIds = new Set();
    data.versionHistory.forEach((revision, index) => {
      const label = `versionHistory[${index}]`;
      if (!assertObject(revision, label, errors)) return;
      if (!/^V\d+\.\d+$/.test(revision.version || "")) errors.push(`${label}.version 格式无效`);
      else if (versionIds.has(revision.version)) errors.push(`${label}.version 重复`);
      else versionIds.add(revision.version);
      if (!CHANGE_TYPES.includes(revision.changeType)) errors.push(`${label}.changeType 无效`);
      if (!hasText(revision.summary)) errors.push(`${label}.summary 缺失`);
      if (!hasText(revision.recordedAt)) errors.push(`${label}.recordedAt 缺失`);
    });
    const current = data.versionHistory.at(-1);
    if (
      current?.version !== data.version ||
      current?.changeType !== data.currentRevision.changeType
    ) {
      errors.push("versionHistory 最后一项必须与当前版本和变更类型一致");
    }
  }

  requireStringArray(data.explicitExclusions, "explicitExclusions", errors);
  if (!Array.isArray(data.businessOpenQuestions)) errors.push("businessOpenQuestions 必须是数组");
  else {
    data.businessOpenQuestions.forEach((question, index) => {
      const label = `businessOpenQuestions[${index}]`;
      if (!assertObject(question, label, errors)) return;
      for (const field of ["question", "requestedFrom", "impact", "resumeWhen"]) {
        if (!hasText(question[field])) errors.push(`${label}.${field} 缺失`);
      }
    });
  }
  if (!Array.isArray(data.implementationPrerequisites))
    errors.push("implementationPrerequisites 必须是数组");
  else {
    data.implementationPrerequisites.forEach((item, index) => {
      const label = `implementationPrerequisites[${index}]`;
      if (!assertObject(item, label, errors)) return;
      for (const field of ["item", "owner", "impact", "readyWhen"]) {
        if (!hasText(item[field])) errors.push(`${label}.${field} 缺失`);
      }
    });
  }

  const taskIds = validateIds(data.tasks, "tasks", errors);
  const context = {
    materialIds,
    requirementIds,
    requirementDispositions,
    applicationScopeIds,
    applicationDispositions,
    integrationScopeIds,
    integrationDispositions,
  };
  for (const [index, task] of asArray(data.tasks).entries()) {
    if (isObject(task)) validateTask(task, `tasks[${index}]`, context, errors);
  }
  if (taskIds.size === 0 && data.status === "formal") errors.push("正式任务清单至少包含一个任务");

  const serialized = JSON.stringify(data);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(serialized)))
    errors.push("研发任务清单疑似包含密钥、令牌或私钥");

  if (data.status === "formal") {
    if ((data.businessOpenQuestions || []).length)
      errors.push("存在会改变业务结果的待确认问题，任务清单不得正式化");
    if (data.confirmations?.engineering?.decision !== "confirmed")
      errors.push("正式任务清单必须由研发负责人确认");
    const productDecision = data.confirmations?.product?.decision;
    if (data.currentRevision?.changeType === "in-scope-omission") {
      if (!["confirmed", "acknowledged"].includes(productDecision))
        errors.push("原范围内任务遗漏版本必须由产品经理确认或知悉");
    } else if (productDecision !== "confirmed") {
      errors.push("首次正式版或业务范围变化版本必须由产品经理确认");
    }
    for (const material of asArray(data.materials)) {
      if (!isObject(material)) continue;
      if (!["verified", "manual-confirmed"].includes(material.baselineState)) {
        errors.push(
          `正式任务清单的材料 ${material.id || material.title || "未命名"} 尚未形成可用评审基线`,
        );
      }
    }
    for (const check of analyzeHandoffCoverage(data)) {
      if (check.status !== "passed")
        errors.push(`正式任务清单未通过${check.label}：${check.detail}`);
    }
  }

  return unique(errors);
}
