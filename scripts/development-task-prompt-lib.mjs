import { assertObject, hasText, requireStringArray } from "./project-lib.mjs";
import { validateDevelopmentHandoff } from "./development-handoff-lib.mjs";

export const MATERIAL_RESOLUTION_STATES = [
  "matched",
  "manual-confirmed",
  "unverified",
  "changed",
  "missing",
];

const RESOLUTION_LABELS = {
  matched: "已核对，与评审基线一致",
  "manual-confirmed": "无法自动核对，已由人工确认",
  unverified: "版本未自动核对，实施前需人工确认",
  changed: "已检测到评审后变化",
  missing: "当前无法访问",
};

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /[?&](?:token|key|secret|password)=[^&\s]+/i,
];

function unique(values) {
  return [...new Set(values)];
}

function list(values, empty = "无") {
  return values?.length ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

function validateExcerpt(excerpt, label, errors) {
  if (!assertObject(excerpt, label, errors)) return;
  if (!hasText(excerpt.section)) errors.push(`${label}.section 缺失`);
  if (!hasText(excerpt.content)) errors.push(`${label}.content 缺失`);
}

function validateResolvedMaterial(item, label, relevantMaterialIds, baselineMaterial, errors) {
  if (!assertObject(item, label, errors)) return;
  if (!hasText(item.materialId)) errors.push(`${label}.materialId 缺失`);
  else if (!relevantMaterialIds.has(item.materialId))
    errors.push(`${label}.materialId 不属于当前任务：${item.materialId}`);
  if (!MATERIAL_RESOLUTION_STATES.includes(item.resolutionState))
    errors.push(`${label}.resolutionState 无效`);
  if (!hasText(item.observedLocator)) errors.push(`${label}.observedLocator 缺失`);
  if (!Array.isArray(item.excerpts)) errors.push(`${label}.excerpts 必须是数组`);
  else
    item.excerpts.forEach((excerpt, index) =>
      validateExcerpt(excerpt, `${label}.excerpts[${index}]`, errors),
    );
  requireStringArray(item.attachments, `${label}.attachments`, errors);
  if (item.resolutionState === "matched" && !hasText(item.observedRevision)) {
    errors.push(`${label} 已核对时必须记录 observedRevision`);
  }
  if (item.resolutionState === "matched" && !hasText(baselineMaterial?.revisionLabel)) {
    errors.push(`${label} 的评审基线没有可自动比对版本，不得标记为 matched`);
  }
  if (
    item.resolutionState === "matched" &&
    hasText(baselineMaterial?.revisionLabel) &&
    item.observedRevision !== baselineMaterial.revisionLabel
  ) {
    errors.push(`${label} 当前版本与评审基线不一致，应标记为 changed`);
  }
  if (item.resolutionState === "manual-confirmed") {
    if (!hasText(item.confirmedBy)) errors.push(`${label}.confirmedBy 缺失`);
    if (!hasText(item.confirmedAt)) errors.push(`${label}.confirmedAt 缺失`);
  }
  if (
    ["unverified", "changed", "missing"].includes(item.resolutionState) &&
    !hasText(item.reason)
  ) {
    errors.push(`${label}.${item.resolutionState} 状态必须说明原因`);
  }
}

export function validateTaskPromptContext(handoff, taskId, context) {
  const errors = [...validateDevelopmentHandoff(handoff)];
  if (handoff?.status !== "formal") errors.push("只有正式研发任务清单才能生成单任务提示词");
  if (!hasText(taskId)) errors.push("必须指定一个任务编号");
  const task = (handoff?.tasks || []).find((candidate) => candidate?.id === taskId);
  if (!task && hasText(taskId)) errors.push(`任务不存在：${taskId}`);
  if (!assertObject(context, "taskContext", errors)) return unique(errors);
  if (context.schemaVersion !== 1) errors.push("taskContext.schemaVersion 必须为 1");
  if (context.listId !== handoff?.listId) errors.push("taskContext.listId 与正式任务清单不一致");
  if (context.listVersion !== handoff?.version)
    errors.push("taskContext.listVersion 与正式任务清单版本不一致");
  if (context.taskId !== taskId) errors.push("taskContext.taskId 与指定任务不一致");
  if (!hasText(context.retrievedAt)) errors.push("taskContext.retrievedAt 缺失");
  if (!Array.isArray(context.materials)) errors.push("taskContext.materials 必须是数组");

  const relevantMaterialIds = new Set(
    (task?.materialRefs || []).map((reference) => reference.materialId),
  );
  const baselineMaterials = new Map(
    (handoff?.materials || []).map((material) => [material.id, material]),
  );
  const contextMaterialIds = new Set();
  for (const [index, item] of (Array.isArray(context.materials)
    ? context.materials
    : []
  ).entries()) {
    validateResolvedMaterial(
      item,
      `taskContext.materials[${index}]`,
      relevantMaterialIds,
      baselineMaterials.get(item?.materialId),
      errors,
    );
    if (!hasText(item?.materialId)) continue;
    if (contextMaterialIds.has(item.materialId))
      errors.push(`taskContext.materials 材料重复：${item.materialId}`);
    contextMaterialIds.add(item.materialId);
  }
  for (const materialId of relevantMaterialIds) {
    if (!contextMaterialIds.has(materialId)) errors.push(`当前任务缺少材料上下文：${materialId}`);
  }
  for (const item of Array.isArray(context.materials) ? context.materials : []) {
    if (item?.resolutionState === "changed")
      errors.push(`材料 ${item.materialId} 在评审后发生变化，停止生成提示词`);
    if (item?.resolutionState === "missing")
      errors.push(`材料 ${item.materialId} 当前无法访问，停止生成提示词`);
  }

  const serialized = JSON.stringify(context);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(serialized)))
    errors.push("单任务材料上下文疑似包含密钥、令牌或私钥");
  return unique(errors);
}

function taskClassification(task) {
  if (task.type === "application-feature") {
    return [
      `- 类型：应用功能任务`,
      `- 应用端：${task.application.application}`,
      `- 菜单／页面：${[...(task.application.menuPath || []), task.application.page].join("／")}`,
      `- 功能操作：${task.application.operation}`,
    ].join("\n");
  }
  if (task.type === "external-integration") {
    return [
      `- 类型：外部系统接口任务`,
      `- 系统方：${task.integration.systemParty}`,
      `- 接口：${task.integration.interfaceName}`,
      `- 调用场景：${task.integration.triggerScenario}`,
    ].join("\n");
  }
  return [
    `- 类型：非页面研发任务`,
    `- 任务分类：${task.nonPage.category}`,
    `- 触发场景：${task.nonPage.triggerScenario}`,
  ].join("\n");
}

function renderMaterialContext(item, material) {
  const lines = [
    `### ${item.materialId} ${material?.title || "未命名材料"}`,
    "",
    `- 材料位置：${item.observedLocator}`,
    `- 核对状态：${RESOLUTION_LABELS[item.resolutionState] || item.resolutionState}`,
  ];
  if (item.observedRevision) lines.push(`- 当前版本：${item.observedRevision}`);
  if (item.resolutionState === "manual-confirmed")
    lines.push(`- 人工确认：${item.confirmedBy}，${item.confirmedAt}`);
  if (item.reason) lines.push(`- 说明：${item.reason}`);
  for (const excerpt of item.excerpts || []) {
    lines.push(
      "",
      `#### 材料片段：${excerpt.section}`,
      "",
      "<source_excerpt>",
      excerpt.content,
      "</source_excerpt>",
    );
  }
  if (item.attachments?.length) lines.push("", "#### 原型或附件", "", list(item.attachments));
  if (!(item.excerpts || []).length && !(item.attachments || []).length) {
    lines.push("", "- 本次未复制材料正文，实施前按上述位置读取对应内容。");
  }
  return lines.join("\n");
}

export function renderDevelopmentTaskPrompt(handoff, taskId, context) {
  const task = handoff.tasks.find((candidate) => candidate.id === taskId);
  const materialsById = new Map(
    (handoff.materials || []).map((material) => [material.id, material]),
  );
  const warnings = (context.materials || [])
    .filter((item) => item.resolutionState === "unverified")
    .map((item) => `${item.materialId} 版本未自动核对：${item.reason}`);
  const lines = [
    `# ${task.id} ${task.title}：研发任务上下文提示词`,
    "",
    "> 生成本提示词不构成实施授权。编程 AI 只能读取、核对并报告就绪情况；收到明确的“开始实施该任务”后才能修改代码。",
    "",
    "## 1. 任务身份",
    "",
    `- 研发任务清单：${handoff.listId} ${handoff.version}`,
    `- 任务编号：${task.id}`,
    `- 关联需求：${task.requirementIds?.join("、") || "无，依据研发确认的技术必要项"}`,
    `- 材料获取时间：${context.retrievedAt}`,
    "",
    taskClassification(task),
    "",
    "## 2. 当前允许动作",
    "",
    "1. 读取本提示词列出的任务范围和关联材料；",
    "2. 检查材料与当前代码是否存在冲突、缺失或越界；",
    "3. 报告是否具备实施条件和唯一下一动作；",
    "4. 在收到明确实施授权前，不修改代码、配置、数据或任务状态。",
    "",
    "## 3. 任务目标与范围",
    "",
    `### 目标\n\n${task.developmentScope}`,
    "",
    "### 本任务范围",
    "",
    `- ${task.developmentScope}`,
    "",
    "### 明确禁止范围",
    "",
    list(handoff.explicitExclusions),
    "",
    `- 不实施同一清单中的其他任务；`,
    `- 不自行增加 ${task.id} 未声明的业务规则、接口字段或技术范围。`,
    "",
    "## 4. 研发评审依据",
    "",
    list(task.reviewBasis),
    "",
    "## 5. 关联材料与片段",
    "",
    ...(context.materials || []).flatMap((item) => [
      renderMaterialContext(item, materialsById.get(item.materialId)),
      "",
    ]),
    "## 6. 验收标准",
    "",
    list(task.acceptanceCriteria),
    "",
    "## 7. 实施前置条件",
    "",
    list(task.prerequisites),
    "",
    "## 8. 材料核对警告",
    "",
    warnings.length ? list(warnings) : "- 当前没有未核对材料。",
    "",
    "检测到材料变化、缺失、业务冲突或会改变验收结果的歧义时，停止并提出一个可回答的问题，不得自行选择。",
    "",
    "## 9. 获得实施授权后的执行约束",
    "",
    `- 只实施 ${task.id}；`,
    "- 先检查现有代码和直接关联文件，不默认扫描或改造整个项目；",
    "- 不创建真实生产凭证、生产数据或未经确认的外部接口；",
    "- 发现新增业务范围时停止，并回到需求或 CR 确认；",
    "- 完成实现后只进入待评审，不自动宣布需求完成。",
    "",
    "## 10. 完成后必须报告",
    "",
    "- 实际修改内容和文件；",
    "- 与任务范围、规则和验收标准的映射；",
    "- 执行的检查及结果；",
    "- 未执行检查及原因；",
    "- 未完成项和遗留风险；",
    "- 是否仍需产品、业务、研发或外部系统方确认；",
    "- 下一步是否已经获得授权。",
    "",
  ];
  return lines.join("\n");
}
