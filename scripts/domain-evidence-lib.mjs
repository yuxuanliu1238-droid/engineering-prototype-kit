import { promises as fs } from "node:fs";
import path from "node:path";

const TEXT = (value) => typeof value === "string" && value.trim().length > 0;
const ARRAY = (value) => Array.isArray(value);

function requireText(value, label, errors) {
  if (!TEXT(value)) errors.push(`${label} 必须是非空字符串`);
}

function requireStringArray(value, label, errors, { nonEmpty = false } = {}) {
  if (!ARRAY(value) || value.some((item) => !TEXT(item)) || (nonEmpty && value.length === 0)) {
    errors.push(`${label} 必须是${nonEmpty ? "非空" : ""}字符串数组`);
    return false;
  }
  return true;
}

function collectIds(items, label, errors) {
  if (!ARRAY(items)) {
    errors.push(`${label} 必须是数组`);
    return new Set();
  }
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    const itemLabel = `${label}[${index}]`;
    if (!item || typeof item !== "object" || ARRAY(item)) {
      errors.push(`${itemLabel} 必须是对象`);
      continue;
    }
    requireText(item.id, `${itemLabel}.id`, errors);
    if (TEXT(item.id)) {
      if (ids.has(item.id)) errors.push(`${label} 的 id 重复：${item.id}`);
      ids.add(item.id);
    }
  }
  return ids;
}

function requireKnownRefs(refs, known, label, errors) {
  if (!requireStringArray(refs, label, errors)) return;
  for (const ref of refs) if (!known.has(ref)) errors.push(`${label} 引用了不存在的 id：${ref}`);
}

export function validateReviewScenarios(data) {
  const errors = [];
  if (!data || typeof data !== "object" || ARRAY(data)) return ["评审场景必须是对象"];
  if (![1, 2].includes(data.schemaVersion)) errors.push("评审场景 schemaVersion 只支持 1 或 2");
  const ids = collectIds(data.scenarios, "scenarios", errors);
  if (!ids.size) errors.push("scenarios 至少包含一个评审场景");
  if (data.schemaVersion !== 2 || !ARRAY(data.scenarios)) return errors;

  for (const [index, scenario] of data.scenarios.entries()) {
    const label = `scenarios[${index}]`;
    if (!scenario || typeof scenario !== "object" || ARRAY(scenario)) continue;
    for (const field of ["name", "validationQuestion", "entryPath", "expectedResult"]) {
      requireText(scenario[field], `${label}.${field}`, errors);
    }
    requireStringArray(scenario.dataRefs, `${label}.dataRefs`, errors, { nonEmpty: true });
    const expected = scenario.expected;
    if (!expected || typeof expected !== "object" || ARRAY(expected)) {
      errors.push(`${label}.expected 必须是对象`);
      continue;
    }
    requireStringArray(expected.matchedRuleRefs, `${label}.expected.matchedRuleRefs`, errors);
    if (expected.selectedRuleRef !== null && expected.selectedRuleRef !== undefined) {
      requireText(expected.selectedRuleRef, `${label}.expected.selectedRuleRef`, errors);
      if (
        TEXT(expected.selectedRuleRef) &&
        ARRAY(expected.matchedRuleRefs) &&
        !expected.matchedRuleRefs.includes(expected.selectedRuleRef)
      ) {
        errors.push(`${label}.expected.selectedRuleRef 必须包含在 matchedRuleRefs 中`);
      }
    }
    requireText(expected.resultRef, `${label}.expected.resultRef`, errors);
    requireText(expected.sourceStateRef, `${label}.expected.sourceStateRef`, errors);
    if (expected.exceptionRef !== null && expected.exceptionRef !== undefined) {
      requireText(expected.exceptionRef, `${label}.expected.exceptionRef`, errors);
    }
    if (!expected.assertions || typeof expected.assertions !== "object" || ARRAY(expected.assertions)) {
      errors.push(`${label}.expected.assertions 必须是对象`);
    } else {
      requireStringArray(expected.assertions.visible, `${label}.expected.assertions.visible`, errors, {
        nonEmpty: true,
      });
      requireStringArray(expected.assertions.hidden, `${label}.expected.assertions.hidden`, errors);
    }
  }
  return errors;
}

export function validateDomainEvidence(data) {
  const errors = [];
  if (!data || typeof data !== "object" || ARRAY(data)) return ["领域证据必须是对象"];
  if (data.schemaVersion !== 1) errors.push("领域证据 schemaVersion 必须为 1");

  const ruleModel = data.ruleModel || {};
  const ruleFields = collectIds(ruleModel.fields, "ruleModel.fields", errors);
  const rules = collectIds(ruleModel.rules, "ruleModel.rules", errors);
  const fieldById = new Map((ruleModel.fields || []).filter((item) => TEXT(item?.id)).map((item) => [item.id, item]));
  for (const [index, field] of (ruleModel.fields || []).entries()) {
    const label = `ruleModel.fields[${index}]`;
    requireText(field.label, `${label}.label`, errors);
    requireText(field.dataSourceRef, `${label}.dataSourceRef`, errors);
    if (!["text", "number", "date", "datetime", "enum", "entity", "entity-set", "boolean"].includes(field.valueType)) {
      errors.push(`${label}.valueType 无效`);
    }
    requireStringArray(field.operators, `${label}.operators`, errors, { nonEmpty: true });
    if (!["forbid", "allow-compatible-range", "allow"].includes(field.repeatPolicy)) {
      errors.push(`${label}.repeatPolicy 无效`);
    }
    if (!["block", "undecidable", "default-approved", "not-applicable"].includes(field.missingDataPolicy)) {
      errors.push(`${label}.missingDataPolicy 无效`);
    }
  }

  const signatures = new Map();
  for (const [index, rule] of (ruleModel.rules || []).entries()) {
    const label = `ruleModel.rules[${index}]`;
    requireText(rule.label, `${label}.label`, errors);
    if (!["all", "any"].includes(rule.conditionLogic)) errors.push(`${label}.conditionLogic 无效`);
    requireText(rule.resultRef, `${label}.resultRef`, errors);
    if (!ARRAY(rule.conditions) || rule.conditions.length === 0) {
      errors.push(`${label}.conditions 必须是非空数组`);
      continue;
    }
    const byField = new Map();
    for (const [conditionIndex, condition] of rule.conditions.entries()) {
      const conditionLabel = `${label}.conditions[${conditionIndex}]`;
      requireText(condition?.fieldRef, `${conditionLabel}.fieldRef`, errors);
      requireText(condition?.operator, `${conditionLabel}.operator`, errors);
      if (!ruleFields.has(condition?.fieldRef)) {
        errors.push(`${conditionLabel}.fieldRef 引用了不存在的规则字段：${condition?.fieldRef}`);
        continue;
      }
      const field = fieldById.get(condition.fieldRef);
      if (TEXT(condition.operator) && !field.operators?.includes(condition.operator)) {
        errors.push(`${conditionLabel}.operator 不属于字段 ${condition.fieldRef} 的可用判断关系`);
      }
      const list = byField.get(condition.fieldRef) || [];
      list.push(condition.operator);
      byField.set(condition.fieldRef, list);
    }
    for (const [fieldRef, operators] of byField) {
      if (operators.length < 2) continue;
      const policy = fieldById.get(fieldRef)?.repeatPolicy;
      const comparisons = new Set([">", ">=", "<", "<="]);
      const compatibleRange =
        policy === "allow-compatible-range" &&
        operators.length === 2 &&
        new Set(operators).size === 2 &&
        operators.every((operator) => comparisons.has(operator));
      if (policy === "forbid" || (policy === "allow-compatible-range" && !compatibleRange)) {
        errors.push(`${label} 重复使用字段 ${fieldRef}，不符合 repeatPolicy`);
      }
    }
    const signature = JSON.stringify(
      [...rule.conditions]
        .map((condition) => [condition.fieldRef, condition.operator, condition.valueRef ?? condition.value])
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    );
    if (signatures.has(signature)) errors.push(`${label} 与规则 ${signatures.get(signature)} 条件完全重复`);
    else signatures.set(signature, rule.id);
  }
  if (!ruleModel.selection || typeof ruleModel.selection !== "object" || ARRAY(ruleModel.selection)) {
    errors.push("ruleModel.selection 必须是对象");
  } else {
    if (!["most-specific-complete-match", "single-match-only", "explicit-priority", "first-match"].includes(ruleModel.selection.strategy)) {
      errors.push("ruleModel.selection.strategy 无效");
    }
    if (!["conflict", "manual-review", "no-result"].includes(ruleModel.selection.unresolvedTie)) {
      errors.push("ruleModel.selection.unresolvedTie 无效");
    }
  }

  const stateModel = data.stateModel || {};
  const states = collectIds(stateModel.states, "stateModel.states", errors);
  const actions = collectIds(stateModel.actions, "stateModel.actions", errors);
  const exceptions = collectIds(stateModel.exceptions, "stateModel.exceptions", errors);
  for (const [index, state] of (stateModel.states || []).entries()) {
    const label = `stateModel.states[${index}]`;
    requireText(state.objectType, `${label}.objectType`, errors);
    requireText(state.meaning, `${label}.meaning`, errors);
    if (typeof state.source !== "boolean") errors.push(`${label}.source 必须是布尔值`);
  }
  for (const [index, action] of (stateModel.actions || []).entries()) {
    const label = `stateModel.actions[${index}]`;
    requireText(action.label, `${label}.label`, errors);
    requireKnownRefs(action.allowedStateRefs, states, `${label}.allowedStateRefs`, errors);
    requireKnownRefs(action.forbiddenStateRefs || [], states, `${label}.forbiddenStateRefs`, errors);
    if (TEXT(action.successStateRef) && !states.has(action.successStateRef)) {
      errors.push(`${label}.successStateRef 引用了不存在的状态：${action.successStateRef}`);
    }
    for (const ref of action.allowedStateRefs || []) {
      if ((action.forbiddenStateRefs || []).includes(ref)) errors.push(`${label} 同时允许并禁止状态：${ref}`);
    }
  }
  for (const [index, exception] of (stateModel.exceptions || []).entries()) {
    const label = `stateModel.exceptions[${index}]`;
    requireText(exception.label, `${label}.label`, errors);
    requireKnownRefs(exception.sourceStateRefs, states, `${label}.sourceStateRefs`, errors);
    requireKnownRefs(exception.recoveryActionRefs, actions, `${label}.recoveryActionRefs`, errors);
    if (typeof exception.changesSourceState !== "boolean") {
      errors.push(`${label}.changesSourceState 必须是布尔值`);
    }
  }

  const integrationModel = data.integrationModel || {};
  const integrationFields = collectIds(integrationModel.fields, "integrationModel.fields", errors);
  collectIds(integrationModel.derivations, "integrationModel.derivations", errors);
  const integrationFieldById = new Map(
    (integrationModel.fields || []).filter((item) => TEXT(item?.id)).map((item) => [item.id, item]),
  );
  for (const [index, field] of (integrationModel.fields || []).entries()) {
    const label = `integrationModel.fields[${index}]`;
    requireText(field.label, `${label}.label`, errors);
    if (!["business-input", "external-return", "system-derived", "display-only"].includes(field.sourceType)) {
      errors.push(`${label}.sourceType 无效`);
    }
    requireText(field.owner, `${label}.owner`, errors);
    requireText(field.sourceRef, `${label}.sourceRef`, errors);
    requireText(field.timing, `${label}.timing`, errors);
    requireText(field.missingPolicy, `${label}.missingPolicy`, errors);
  }
  for (const [index, derivation] of (integrationModel.derivations || []).entries()) {
    const label = `integrationModel.derivations[${index}]`;
    requireKnownRefs(derivation.inputFieldRefs, integrationFields, `${label}.inputFieldRefs`, errors);
    requireText(derivation.outputFieldRef, `${label}.outputFieldRef`, errors);
    if (TEXT(derivation.outputFieldRef) && !integrationFields.has(derivation.outputFieldRef)) {
      errors.push(`${label}.outputFieldRef 引用了不存在的字段：${derivation.outputFieldRef}`);
    } else if (
      TEXT(derivation.outputFieldRef) &&
      integrationFieldById.get(derivation.outputFieldRef)?.sourceType !== "system-derived"
    ) {
      errors.push(`${label}.outputFieldRef 必须指向 system-derived 字段`);
    }
    requireText(derivation.formula, `${label}.formula`, errors);
    requireText(derivation.timing, `${label}.timing`, errors);
  }

  return { errors, refs: { rules, states, actions, exceptions } };
}

export function validateScenarioClosure(scenarios, domainEvidence) {
  const errors = [];
  if (scenarios?.schemaVersion !== 2 || !ARRAY(scenarios.scenarios) || !domainEvidence) return errors;
  const result = validateDomainEvidence(domainEvidence);
  const { rules, states, exceptions } = result.refs;
  for (const [index, scenario] of scenarios.scenarios.entries()) {
    const label = `scenarios[${index}].expected`;
    for (const ref of scenario.expected?.matchedRuleRefs || []) {
      if (!rules.has(ref)) errors.push(`${label}.matchedRuleRefs 引用了不存在的规则：${ref}`);
    }
    if (TEXT(scenario.expected?.sourceStateRef) && !states.has(scenario.expected.sourceStateRef)) {
      errors.push(`${label}.sourceStateRef 引用了不存在的状态：${scenario.expected.sourceStateRef}`);
    }
    if (TEXT(scenario.expected?.exceptionRef) && !exceptions.has(scenario.expected.exceptionRef)) {
      errors.push(`${label}.exceptionRef 引用了不存在的异常：${scenario.expected.exceptionRef}`);
    }
  }
  return errors;
}

async function readOptionalJson(root, relativePath) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`${relativePath} 不是有效 JSON：${error.message}`);
  }
}

export async function validateDomainEvidenceProject(root, { print = true } = {}) {
  const config = await readOptionalJson(root, "project.config.json");
  const scenariosPath = config?.paths?.reviewScenarios || "prototype/src/review-scenarios.json";
  const domainPath = config?.paths?.domainEvidence || "docs/domain/domain-evidence.json";
  const scenarios = await readOptionalJson(root, scenariosPath);
  const domainEvidence = await readOptionalJson(root, domainPath);
  const errors = [];
  if (scenarios) errors.push(...validateReviewScenarios(scenarios));
  if (domainEvidence) {
    errors.push(...validateDomainEvidence(domainEvidence).errors);
    if (scenarios) errors.push(...validateScenarioClosure(scenarios, domainEvidence));
  }
  const unique = [...new Set(errors)];
  if (print) {
    if (unique.length) {
      console.error(`领域证据校验失败（${unique.length} 项）：`);
      for (const error of unique) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `领域证据校验通过：${scenarios?.scenarios?.length || 0} 个评审场景，${
          domainEvidence?.ruleModel?.rules?.length || 0
        } 条结构化规则`,
      );
    }
  }
  return unique;
}
