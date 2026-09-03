export const VALIDATION_FOCUSES = [
  "business-solution",
  "prototype-presentation",
  "generation-workflow",
];

export const INPUT_SUFFICIENCY_LEVELS = ["sufficient", "partial", "insufficient"];
export const SOURCE_TYPES = ["material-explicit", "flow-inferred", "ai-candidate", "product-confirmed"];

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseFocuses(value) {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  if (!text(value)) return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function validateValidationProfile(profile, { allowInsufficient = false } = {}) {
  const errors = [];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return ["validationProfile 缺失"];
  const focuses = parseFocuses(profile.focuses);
  if (!focuses.length) errors.push("validationProfile.focuses 至少包含一个评审目标");
  for (const focus of focuses) {
    if (!VALIDATION_FOCUSES.includes(focus)) errors.push(`未知评审目标：${focus}`);
  }
  if (!VALIDATION_FOCUSES.includes(profile.primaryFocus)) errors.push("validationProfile.primaryFocus 无效");
  else if (!focuses.includes(profile.primaryFocus)) errors.push("主要评审目标必须包含在 focuses 中");
  if (profile.recommendedBy !== "ai") errors.push("评审目标必须由 AI 推荐");
  if (!text(profile.recommendationReason)) errors.push("缺少评审目标推荐理由");
  if (profile.confirmationState !== "confirmed") errors.push("评审目标必须经产品经理确认");
  if (!text(profile.confirmedBy) || !text(profile.confirmedAt)) errors.push("评审目标确认记录不完整");

  const sufficiency = profile.inputSufficiency;
  if (!sufficiency || typeof sufficiency !== "object" || Array.isArray(sufficiency)) {
    errors.push("validationProfile.inputSufficiency 缺失");
  } else {
    if (!INPUT_SUFFICIENCY_LEVELS.includes(sufficiency.level)) errors.push("输入充分度等级无效");
    if (!allowInsufficient && sufficiency.level === "insufficient") errors.push("输入不充分时只能业务探索，不得创建 Demo 项目");
    if (!text(sufficiency.reason)) errors.push("缺少输入充分度判断理由");
    for (const field of ["known", "missing", "canProceed", "requiresConfirmation", "mustNotDo"]) {
      if (!Array.isArray(sufficiency[field])) errors.push(`inputSufficiency.${field} 必须是数组`);
    }
  }

  const reviewCenter = profile.reviewCenter;
  if (!reviewCenter || typeof reviewCenter !== "object" || Array.isArray(reviewCenter)) {
    errors.push("validationProfile.reviewCenter 缺失");
  } else {
    if (typeof reviewCenter.enabled !== "boolean") errors.push("reviewCenter.enabled 必须是布尔值");
    if (!text(reviewCenter.reason)) errors.push("缺少评审中心启用或停用理由");
  }
  return errors;
}

export function validateReviewScenarios(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) return ["评审场景配置必须是对象"];
  if (data.schemaVersion !== 1) errors.push("评审场景 schemaVersion 必须为 1");
  if (!Array.isArray(data.scenarios) || !data.scenarios.length) return [...errors, "启用评审中心时至少需要一个场景"];
  const ids = new Set();
  for (const [index, scenario] of data.scenarios.entries()) {
    const label = `scenarios[${index}]`;
    for (const field of ["id", "category", "name", "validationQuestion", "entryPath", "expectedResult", "owner", "status"]) {
      if (!text(scenario?.[field])) errors.push(`${label}.${field} 缺失`);
    }
    if (text(scenario?.id)) {
      if (ids.has(scenario.id)) errors.push(`评审场景 ID 重复：${scenario.id}`);
      ids.add(scenario.id);
    }
    if (text(scenario?.entryPath) && !scenario.entryPath.startsWith("/app")) errors.push(`${label}.entryPath 必须进入 /app 业务路由`);
    if (!Array.isArray(scenario?.sources) || !scenario.sources.length) errors.push(`${label}.sources 至少包含一个来源`);
    for (const source of scenario?.sources || []) {
      if (!SOURCE_TYPES.includes(source)) errors.push(`${label}.sources 包含未知来源：${source}`);
    }
    if (!Array.isArray(scenario?.assumptions)) errors.push(`${label}.assumptions 必须是数组`);
    if (!Array.isArray(scenario?.openQuestions)) errors.push(`${label}.openQuestions 必须是数组`);
    if (!["pending", "in-review", "accepted", "needs-adjustment", "deferred"].includes(scenario?.status)) errors.push(`${label}.status 无效`);
  }
  return errors;
}
