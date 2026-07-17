import { assertObject, hasText, requireStringArray } from "./project-lib.mjs";

const URL_PATTERN = /https?:\/\/|\/api\//i;

export function validateContractsData(contracts, config) {
  const errors = [];
  if (!Array.isArray(contracts)) return ["页面契约注册表必须是数组"];

  const pageIds = new Set();
  const globalIds = new Set();
  const allowedStatuses = config.validation.implementationStatuses;
  const allowedSurfaces = config.validation.allowedSurfaces;

  contracts.forEach((contract, index) => {
    const label = `contracts[${index}]`;
    if (!assertObject(contract, label, errors)) return;
    if (contract.schemaVersion !== 1) errors.push(`${label}.schemaVersion 必须为 1`);
    for (const field of ["pageId", "title", "goal"]) {
      if (!hasText(contract[field])) errors.push(`${label}.${field} 缺失`);
    }
    if (pageIds.has(contract.pageId)) errors.push(`页面 ID 重复：${contract.pageId}`);
    pageIds.add(contract.pageId);
    if (!allowedSurfaces.includes(contract.surface)) errors.push(`${label}.surface 无效`);
    if (!allowedStatuses.includes(contract.implementationStatus)) {
      errors.push(`${label}.implementationStatus 无效`);
    }
    if (!assertObject(contract.preview, `${label}.preview`, errors)) return;
    if (!hasText(contract.preview.entry) || !/\.html$/.test(contract.preview.entry)) {
      errors.push(`${label}.preview.entry 必须是 HTML 入口`);
    }
    if (!hasText(contract.preview.defaultStateId)) {
      errors.push(`${label}.preview.defaultStateId 缺失`);
    }

    for (const collection of [
      "sections",
      "actions",
      "states",
      "rules",
      "dataFields",
      "integrations",
      "exceptions",
      "acceptanceCriteria",
    ]) {
      if (!Array.isArray(contract[collection])) errors.push(`${label}.${collection} 必须是数组`);
    }

    const localActionIds = new Set();
    for (const [actionIndex, action] of (contract.actions || []).entries()) {
      const actionLabel = `${label}.actions[${actionIndex}]`;
      for (const field of [
        "id",
        "label",
        "trigger",
        "successResult",
        "failureHandling",
      ]) {
        if (!hasText(action[field])) errors.push(`${actionLabel}.${field} 缺失`);
      }
      for (const field of ["preconditions", "validations", "dataEffects"]) {
        requireStringArray(action[field], `${actionLabel}.${field}`, errors);
      }
      if (globalIds.has(action.id)) errors.push(`子项 ID 重复：${action.id}`);
      globalIds.add(action.id);
      localActionIds.add(action.id);
    }

    for (const [stateIndex, state] of (contract.states || []).entries()) {
      const stateLabel = `${label}.states[${stateIndex}]`;
      for (const field of ["id", "label", "enterWhen", "visibleChanges", "recovery"]) {
        if (!hasText(state[field])) errors.push(`${stateLabel}.${field} 缺失`);
      }
      requireStringArray(state.allowedActionIds, `${stateLabel}.allowedActionIds`, errors);
      for (const actionId of state.allowedActionIds || []) {
        if (!localActionIds.has(actionId)) {
          errors.push(`${stateLabel} 引用未知动作：${actionId}`);
        }
      }
      if (globalIds.has(state.id)) errors.push(`子项 ID 重复：${state.id}`);
      globalIds.add(state.id);
    }

    for (const integration of contract.integrations || []) {
      if (!["placeholder", "confirmed"].includes(integration.status)) {
        errors.push(`${integration.id || label} 的接口状态无效`);
      }
      if (URL_PATTERN.test(JSON.stringify(integration))) {
        errors.push(`${integration.id || label} 包含不允许的接口 URL`);
      }
    }

    for (const acceptance of contract.acceptanceCriteria || []) {
      for (const field of ["id", "given", "when", "then"]) {
        if (!hasText(acceptance[field])) errors.push(`${label}.acceptanceCriteria.${field} 缺失`);
      }
      if (globalIds.has(acceptance.id)) errors.push(`子项 ID 重复：${acceptance.id}`);
      globalIds.add(acceptance.id);
    }

    if (!(contract.states || []).some((state) => state.id === contract.preview.defaultStateId)) {
      errors.push(`${contract.pageId} 默认状态未在 states 注册`);
    }
  });

  for (const contract of contracts) {
    for (const action of contract.actions || []) {
      if (action.nextPageId && !pageIds.has(action.nextPageId)) {
        errors.push(`${action.id} 指向未知页面：${action.nextPageId}`);
      }
    }
  }

  return errors;
}
