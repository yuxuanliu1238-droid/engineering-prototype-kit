export function sourceLink(value) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function resolveReview(content, location = {}, action = null) {
  const mappings = content.pageMappings.filter((item) => item.page === location.page && (!item.detail || item.detail === (location.detailId ? "present" : "absent")) && (!item.mode || item.mode === location.mode));
  mappings.sort((a,b) => Number(!!b.detail) + Number(!!b.mode) - Number(!!a.detail) - Number(!!a.mode));
  const mapping = mappings[0];
  const actionMapping = content.actionMappings.find((item) => item.action === action);
  const byIds = (ids = []) => [...new Set(ids)].map((id) => content.sections.find((item) => item.id === id)).filter(Boolean);
  return { current: byIds([actionMapping?.sectionId || mapping?.sectionId])[0] || null, related: byIds(mapping?.relatedSectionIds), global: byIds(content.globalSectionIds) };
}

export function validateReviewContent(content) {
  const errors = [];
  if (content.schemaVersion !== 1) errors.push("schemaVersion 必须为1");
  if (!/^\/app(?:\/|$)/.test(content.demoEntry || "") || /[\\\\#]/.test(content.demoEntry || "")) errors.push("demoEntry 必须为同源 /app 路由");
  if (!Number.isFinite(content.minimumDemoWidth) || content.minimumDemoWidth < 360) errors.push("minimumDemoWidth 至少为360");
  const ids = new Set();
  for (const section of content.sections || []) {
    if (!section.id || ids.has(section.id)) errors.push("章节id缺失或重复");
    ids.add(section.id);
    if (!section.title || typeof section.body !== "string") errors.push("章节需要title和body");
    if (section.sourceUrl && !sourceLink(section.sourceUrl)) errors.push("章节来源URL无效");
  }
  for (const mapping of [...(content.pageMappings || []), ...(content.actionMappings || [])]) {
    for (const id of [mapping.sectionId, ...(mapping.relatedSectionIds || [])]) if (!ids.has(id)) errors.push(`关联章节不存在：${id}`);
  }
  for (const id of content.globalSectionIds || []) if (!ids.has(id)) errors.push(`全局章节不存在：${id}`);
  if (content.source?.url && !sourceLink(content.source.url)) errors.push("来源URL无效");
  return errors;
}
