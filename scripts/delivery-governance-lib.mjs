import { promises as fs } from "node:fs";
import path from "node:path";

const TEXT = (value) => typeof value === "string" && value.trim().length > 0;
const ARRAY = Array.isArray;

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

function uniqueItems(items, label, errors) {
  if (!ARRAY(items)) {
    errors.push(`${label} 必须是数组`);
    return new Set();
  }
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || ARRAY(item)) {
      errors.push(`${label}[${index}] 必须是对象`);
      continue;
    }
    requireText(item.id, `${label}[${index}].id`, errors);
    if (TEXT(item.id)) {
      if (ids.has(item.id)) errors.push(`${label} 的 id 重复：${item.id}`);
      ids.add(item.id);
    }
  }
  return ids;
}

const PURPOSE_TREATMENT = {
  business: "include",
  "review-only": "exclude",
  support: "separate",
  future: "planned",
};

const REQUIRED_B2B_AREAS = new Set([
  "navigation",
  "information-hierarchy",
  "responsive",
  "overlay-interaction",
]);

export function validateDeliveryGovernance(data, { requireResolved = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object" || ARRAY(data)) return ["交付治理必须是对象"];
  if (data.schemaVersion !== 1) errors.push("交付治理 schemaVersion 必须为 1");

  uniqueItems(data.capabilityCatalog, "capabilityCatalog", errors);
  for (const [index, capability] of (data.capabilityCatalog || []).entries()) {
    const label = `capabilityCatalog[${index}]`;
    requireText(capability.label, `${label}.label`, errors);
    requireText(capability.pageRef, `${label}.pageRef`, errors);
    if (!(capability.purpose in PURPOSE_TREATMENT)) errors.push(`${label}.purpose 无效`);
    if (PURPOSE_TREATMENT[capability.purpose] !== capability.requirementTreatment) {
      errors.push(
        `${label}.requirementTreatment 应为 ${PURPOSE_TREATMENT[capability.purpose] || "有效值"}`,
      );
    }
    requireStringArray(capability.allowedStateRefs, `${label}.allowedStateRefs`);
    requireText(capability.visibilityRule, `${label}.visibilityRule`, errors);
  }

  uniqueItems(data.changeImpacts, "changeImpacts", errors);
  const impactKeys = [
    "fields",
    "rules",
    "states",
    "pages",
    "fixtures",
    "documents",
    "integrations",
  ];
  for (const [index, impact] of (data.changeImpacts || []).entries()) {
    const label = `changeImpacts[${index}]`;
    requireText(impact.decisionRef, `${label}.decisionRef`, errors);
    requireText(impact.reason, `${label}.reason`, errors);
    if (!impact.affected || typeof impact.affected !== "object" || ARRAY(impact.affected)) {
      errors.push(`${label}.affected 必须是对象`);
    } else {
      for (const key of impactKeys) requireStringArray(impact.affected[key], `${label}.affected.${key}`, errors);
      if (!impactKeys.some((key) => impact.affected[key]?.length)) {
        errors.push(`${label}.affected 至少声明一类受影响目标`);
      }
    }
    requireStringArray(impact.acceptanceScenarioRefs, `${label}.acceptanceScenarioRefs`, errors, {
      nonEmpty: true,
    });
  }

  const experience = data.b2bExperience;
  if (!experience || typeof experience !== "object" || ARRAY(experience)) {
    errors.push("b2bExperience 必须是对象");
  } else {
    if (!["host-convention", "breadcrumb", "page-title", "tabs", "custom", "unknown"].includes(experience.navigationPattern)) {
      errors.push("b2bExperience.navigationPattern 无效");
    }
    if (experience.navigationPattern !== "unknown") {
      requireText(experience.hostConventionEvidence, "b2bExperience.hostConventionEvidence", errors);
    }
    uniqueItems(experience.checks, "b2bExperience.checks", errors);
    const areas = new Set();
    for (const [index, check] of (experience.checks || []).entries()) {
      const label = `b2bExperience.checks[${index}]`;
      if (![...REQUIRED_B2B_AREAS, "accessibility", "content-density"].includes(check.area)) {
        errors.push(`${label}.area 无效`);
      } else areas.add(check.area);
      requireText(check.requirement, `${label}.requirement`, errors);
      if (!["pending", "passed", "failed", "not-applicable"].includes(check.status)) {
        errors.push(`${label}.status 无效`);
      }
      requireStringArray(check.evidenceRefs, `${label}.evidenceRefs`, errors);
      if (check.status === "passed" && !check.evidenceRefs?.length) {
        errors.push(`${label} 标记 passed 时必须提供 evidenceRefs`);
      }
      if (check.status === "not-applicable") requireText(check.reason, `${label}.reason`, errors);
      if (requireResolved && !["passed", "not-applicable"].includes(check.status)) {
        errors.push(`${label} 在最终交付前必须为 passed 或 not-applicable`);
      }
    }
    for (const area of REQUIRED_B2B_AREAS) {
      if (!areas.has(area)) errors.push(`b2bExperience.checks 缺少必查领域：${area}`);
    }
  }

  return errors;
}

export function validateDeliveryGovernanceRefs(data, { scenarioIds = new Set(), stateIds = new Set() } = {}) {
  const errors = [];
  for (const [index, capability] of (data?.capabilityCatalog || []).entries()) {
    for (const ref of capability.allowedStateRefs || []) {
      if (!stateIds.has(ref)) {
        errors.push(`capabilityCatalog[${index}].allowedStateRefs 引用了不存在的状态：${ref}`);
      }
    }
  }
  for (const [index, impact] of (data?.changeImpacts || []).entries()) {
    for (const ref of impact.acceptanceScenarioRefs || []) {
      if (!scenarioIds.has(ref)) {
        errors.push(`changeImpacts[${index}].acceptanceScenarioRefs 引用了不存在的场景：${ref}`);
      }
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

export async function validateDeliveryGovernanceProject(
  root,
  { print = true, requireResolved = false } = {},
) {
  const config = await readOptionalJson(root, "project.config.json");
  const governancePath = config?.paths?.deliveryGovernance || "docs/review/delivery-governance.json";
  const governance = await readOptionalJson(root, governancePath);
  if (!governance) return [];
  const scenarios = await readOptionalJson(
    root,
    config?.paths?.reviewScenarios || "prototype/src/review-scenarios.json",
  );
  const domain = await readOptionalJson(
    root,
    config?.paths?.domainEvidence || "docs/domain/domain-evidence.json",
  );
  const scenarioIds = new Set((scenarios?.scenarios || []).map((item) => item.id).filter(TEXT));
  const stateIds = new Set((domain?.stateModel?.states || []).map((item) => item.id).filter(TEXT));
  const errors = [
    ...validateDeliveryGovernance(governance, { requireResolved }),
    ...validateDeliveryGovernanceRefs(governance, { scenarioIds, stateIds }),
  ];
  const unique = [...new Set(errors)];
  if (print) {
    if (unique.length) {
      console.error(`交付治理校验失败（${unique.length} 项）：`);
      for (const error of unique) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `交付治理校验通过：${governance.capabilityCatalog?.length || 0} 项能力，${
          governance.changeImpacts?.length || 0
        } 条变更影响${requireResolved ? "，最终交付检查已完成" : ""}`,
      );
    }
  }
  return unique;
}
