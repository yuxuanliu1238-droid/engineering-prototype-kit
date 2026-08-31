import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";

const RISK_LEVELS = new Set(["low", "medium", "high"]);
const PRIORITIES = new Set(["required", "optional"]);
const SUFFICIENCY_STATUSES = new Set(["sufficient", "insufficient"]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(value, label, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || value.some((item) => !hasText(item))) {
    errors.push(`${label} 必须是字符串数组`);
    return;
  }
  if (!allowEmpty && value.length === 0) errors.push(`${label} 至少包含一项`);
  if (new Set(value).size !== value.length) errors.push(`${label} 不得重复`);
}

export function validateEvidencePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return ["证据计划必须是对象"];
  if (plan.schemaVersion !== 1) errors.push("schemaVersion 必须为 1");

  const scope = plan.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) errors.push("scope 必须是对象");
  else {
    if (!hasText(scope.changeId)) errors.push("scope.changeId 不能为空");
    if (!hasText(scope.summary)) errors.push("scope.summary 不能为空");
    validateStringArray(scope.sourceRefs, "scope.sourceRefs", errors, { allowEmpty: false });
    if (!hasText(scope.authorizationBasis)) errors.push("scope.authorizationBasis 不能为空");
  }

  const risk = plan.riskAssessment;
  if (!risk || typeof risk !== "object" || Array.isArray(risk)) errors.push("riskAssessment 必须是对象");
  else {
    if (!RISK_LEVELS.has(risk.level)) errors.push("riskAssessment.level 必须为 low、medium 或 high");
    validateStringArray(risk.reasons, "riskAssessment.reasons", errors, { allowEmpty: false });
    validateStringArray(risk.dimensions, "riskAssessment.dimensions", errors);
  }

  if (!Array.isArray(plan.scenarios) || plan.scenarios.length === 0) {
    errors.push("scenarios 至少包含一个场景");
  }
  const scenarioIds = new Set();
  for (const [index, scenario] of (plan.scenarios || []).entries()) {
    const label = `scenarios[${index}]`;
    if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
      errors.push(`${label} 必须是对象`);
      continue;
    }
    if (!hasText(scenario.id)) errors.push(`${label}.id 不能为空`);
    else if (scenarioIds.has(scenario.id)) errors.push(`场景编号重复：${scenario.id}`);
    else scenarioIds.add(scenario.id);
    if (!PRIORITIES.has(scenario.priority)) errors.push(`${label}.priority 必须为 required 或 optional`);
    validateStringArray(scenario.pageIds, `${label}.pageIds`, errors, { allowEmpty: false });
    validateStringArray(scenario.stateIds, `${label}.stateIds`, errors);
    validateStringArray(scenario.actionIds, `${label}.actionIds`, errors);
    validateStringArray(scenario.exceptions, `${label}.exceptions`, errors);
    validateStringArray(scenario.viewports, `${label}.viewports`, errors, { allowEmpty: false });
    if (!hasText(scenario.expectedOutcome)) errors.push(`${label}.expectedOutcome 不能为空`);
    validateStringArray(scenario.evidenceRequirements, `${label}.evidenceRequirements`, errors, { allowEmpty: false });
  }

  const sufficiency = plan.sufficiency;
  if (!sufficiency || typeof sufficiency !== "object" || Array.isArray(sufficiency)) {
    errors.push("sufficiency 必须是对象");
    return errors;
  }
  if (!SUFFICIENCY_STATUSES.has(sufficiency.status)) errors.push("sufficiency.status 必须为 sufficient 或 insufficient");
  validateStringArray(sufficiency.coveredScenarioIds, "sufficiency.coveredScenarioIds", errors);
  const covered = new Set(sufficiency.coveredScenarioIds || []);
  for (const scenarioId of covered) if (!scenarioIds.has(scenarioId)) errors.push(`coveredScenarioIds 引用未知场景：${scenarioId}`);

  if (!Array.isArray(sufficiency.missing)) errors.push("sufficiency.missing 必须是数组");
  const missingIds = new Set();
  for (const [index, item] of (sufficiency.missing || []).entries()) {
    const label = `sufficiency.missing[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label} 必须是对象`);
      continue;
    }
    if (!hasText(item.scenarioId)) errors.push(`${label}.scenarioId 不能为空`);
    else {
      if (!scenarioIds.has(item.scenarioId)) errors.push(`${label} 引用未知场景：${item.scenarioId}`);
      if (missingIds.has(item.scenarioId)) errors.push(`缺失场景重复：${item.scenarioId}`);
      missingIds.add(item.scenarioId);
      if (covered.has(item.scenarioId)) errors.push(`${item.scenarioId} 不能同时标记已覆盖和缺失`);
    }
    if (!hasText(item.reason)) errors.push(`${label}.reason 不能为空`);
  }

  const requiredIds = (plan.scenarios || [])
    .filter((scenario) => scenario?.priority === "required" && hasText(scenario.id))
    .map((scenario) => scenario.id);
  if (sufficiency.status === "sufficient") {
    if ((sufficiency.missing || []).length) errors.push("充分时 sufficiency.missing 必须为空");
    for (const scenarioId of requiredIds) if (!covered.has(scenarioId)) errors.push(`充分时必须覆盖必需场景：${scenarioId}`);
  }
  if (sufficiency.status === "insufficient" && !(sufficiency.missing || []).length) {
    errors.push("不充分时至少列出一项缺失证据");
  }
  return errors;
}

async function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error("用法：node validate-evidence-plan.mjs <evidence-plan.json>");
    process.exitCode = 1;
    return;
  }
  const plan = JSON.parse(await fs.readFile(filename, "utf8"));
  const errors = validateEvidencePlan(plan);
  if (errors.length) {
    console.error(`场景证据计划校验失败（${errors.length} 项）：`);
    for (const error of [...new Set(errors)]) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`场景证据计划校验通过：${plan.scenarios.length} 个场景，充分性为 ${plan.sufficiency.status}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();
