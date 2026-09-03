import { validateContractsData } from "./contract-lib.mjs";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value) {
  return Array.isArray(value) && value.every(hasText);
}

function escapeCell(value) {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function join(values) {
  return values?.length ? values.join("、") : "无";
}

export function validateBusinessPageContracts(contracts, registry, config) {
  const errors = validateContractsData(contracts, config);
  const items = new Map((registry.items || []).map((item) => [item.id, item]));

  for (const [index, contract] of (contracts || []).entries()) {
    const label = `contracts[${index}]`;
    if (!hasText(contract.sourceCrId)) {
      errors.push(`${label}.sourceCrId 缺失`);
      continue;
    }
    const sourceCr = items.get(contract.sourceCrId);
    if (!sourceCr) {
      errors.push(`${label}.sourceCrId 指向未知 CR：${contract.sourceCrId}`);
      continue;
    }
    const risk = sourceCr.riskAssessment;
    if (!risk || !["standard", "high"].includes(risk.confirmedLevel)) {
      errors.push(`${contract.pageId || label} 的正式页面契约只能由标准或高风险 CR 触发`);
    }
    if (!["implementation", "awaiting-review", "completed"].includes(sourceCr.currentStageId)) {
      errors.push(`${contract.pageId || label} 的来源 CR 尚未进入实施阶段`);
    }
    if (!(sourceCr.pageIds || []).includes(contract.pageId)) {
      errors.push(`${contract.pageId || label} 不在来源 CR 的触达页面中`);
    }
    for (const collection of ["actions", "states", "acceptanceCriteria"]) {
      if (!contract[collection]?.length) errors.push(`${contract.pageId || label}.${collection} 不得为空`);
    }

    if (risk?.confirmedLevel !== "high") continue;
    const triggers = new Set(risk.triggers || []);
    const controls = contract.riskControls || {};
    if (triggers.has("permissions") && !stringArray(controls.permissions)) {
      errors.push(`${contract.pageId}.riskControls.permissions 缺失`);
    }
    if (triggers.has("data-scope") && !stringArray(controls.dataScope)) {
      errors.push(`${contract.pageId}.riskControls.dataScope 缺失`);
    }
    if (triggers.has("external-system") && !(contract.integrations || []).length) {
      errors.push(`${contract.pageId} 外部系统高风险缺少 integrations`);
    }
    if (["failure-recovery", "batch-async"].some((trigger) => triggers.has(trigger)) && !(contract.exceptions || []).length) {
      errors.push(`${contract.pageId} 异常或批量高风险缺少 exceptions`);
    }
    if (["money", "destructive", "sensitive-data", "security"].some((trigger) => triggers.has(trigger)) && !stringArray(controls.specialistConfirmations)) {
      errors.push(`${contract.pageId}.riskControls.specialistConfirmations 缺失`);
    }
  }
  return errors;
}

export function renderPageGuides(contracts) {
  const lines = [
    "# 页面说明",
    "",
    "<!-- 本文件由 prototype/src/contracts/contracts.json 与当前原型确定性生成，请勿直接编辑。 -->",
    "",
  ];
  if (!contracts.length) {
    lines.push("当前没有已触发的正式页面契约。", "");
    return lines.join("\n");
  }

  for (const contract of contracts) {
    lines.push(
      `## ${contract.pageId} ${contract.title}`,
      "",
      `- 来源 CR：${contract.sourceCrId}`,
      `- 端与入口：${contract.surface} / ${contract.preview.entry}`,
      `- 页面目标：${contract.goal}`,
      `- 实现状态：${contract.implementationStatus}`,
      "",
      "### 页面区块",
      "",
      "| ID | 名称 | 说明 | 实现状态 |",
      "|---|---|---|---|",
    );
    for (const section of contract.sections || []) {
      lines.push(`| ${escapeCell(section.id)} | ${escapeCell(section.title)} | ${escapeCell(section.description)} | ${escapeCell(section.implementationStatus)} |`);
    }
    if (!(contract.sections || []).length) lines.push("| - | 无独立区块 | - | - |");

    lines.push("", "### 操作", "", "| Action ID | 操作 | 触发 | 成功结果 | 失败处理 | 实现状态 |", "|---|---|---|---|---|---|");
    for (const action of contract.actions || []) {
      lines.push(`| ${escapeCell(action.id)} | ${escapeCell(action.label)} | ${escapeCell(action.trigger)} | ${escapeCell(action.successResult)} | ${escapeCell(action.failureHandling)} | ${escapeCell(action.implementationStatus)} |`);
    }

    lines.push("", "### 页面状态", "", "| State ID | 状态 | 进入条件 | 可见变化 | 允许操作 | 恢复方式 |", "|---|---|---|---|---|---|");
    for (const state of contract.states || []) {
      lines.push(`| ${escapeCell(state.id)} | ${escapeCell(state.label)} | ${escapeCell(state.enterWhen)} | ${escapeCell(state.visibleChanges)} | ${escapeCell(join(state.allowedActionIds))} | ${escapeCell(state.recovery)} |`);
    }

    lines.push("", "### 可观察验收事实", "", "| ID | Given | When | Then | 实现状态 |", "|---|---|---|---|---|");
    for (const acceptance of contract.acceptanceCriteria || []) {
      lines.push(`| ${escapeCell(acceptance.id)} | ${escapeCell(acceptance.given)} | ${escapeCell(acceptance.when)} | ${escapeCell(acceptance.then)} | ${escapeCell(acceptance.implementationStatus)} |`);
    }

    lines.push(
      "",
      "### 风险相关信息",
      "",
      `- 数据字段：${join((contract.dataFields || []).map((field) => `${field.name}（${field.sensitivity || "未标注"}）`))}`,
      `- 权限控制：${join(contract.riskControls?.permissions)}`,
      `- 数据范围：${join(contract.riskControls?.dataScope)}`,
      `- 外部集成：${join((contract.integrations || []).map((integration) => integration.name || integration.id))}`,
      `- 异常与恢复：${join((contract.exceptions || []).map((exception) => exception.handling || exception.id))}`,
      `- 专项确认：${join(contract.riskControls?.specialistConfirmations)}`,
      "",
    );
  }
  return lines.join("\n");
}
