import { ACTIVITY_LABELS } from "./model.mjs";
import { deriveReadiness, deriveStatusCard } from "./policy.mjs";

export function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

export function renderList(values, emptyText = "无") {
  if (!values?.length) return `- ${emptyText}`;
  return values.map((value) => `- ${value}`).join("\n");
}

export function renderRequirements(registry) {
  const items = registry.items || [];
  const lines = [
    "# 需求与变更台账",
    "",
    "<!-- 本文件由 docs/requirements/registry.json 确定性生成，请勿直接编辑。 -->",
    "",
    "## 1. 当前总览",
    "",
    `- 需求总数：${items.length}`,
    `- 实施阶段：${items.filter((item) => item.currentStageId === "implementation").length}`,
    `- 等待确认：${items.filter((item) => item.executionState === "waiting-human").length}`,
    `- 待评审：${items.filter((item) => item.currentStageId === "awaiting-review").length}`,
    `- 高风险：${items.filter((item) => item.riskAssessment?.confirmedLevel === "high").length}`,
    `- 已完成：${items.filter((item) => item.currentStageId === "completed").length}`,
    "",
  ];
  if (!items.length) {
    lines.push("当前没有已登记的增量需求。", "");
    return lines.join("\n");
  }

  lines.push(
    "| 编号 | 需求 | 风险 | 当前阶段 | 当前结论 | 责任人 | 下一步 |",
    "|---|---|---|---|---|---|---|",
  );
  for (const item of items) {
    const card = deriveStatusCard(item);
    lines.push(
      `| ${escapeCell(item.id)} | ${escapeCell(item.summary)} | ${escapeCell(item.riskAssessment?.confirmedLevel || "待评估")} | ${escapeCell(card.stage)} | ${escapeCell(card.verdict)} | ${escapeCell(card.owner)} | ${escapeCell(card.nextAction)} |`,
    );
  }
  lines.push("", "## 2. 单条需求详情", "");

  for (const item of items) {
    const card = deriveStatusCard(item);
    lines.push(
      `### ${item.id} ${item.summary}`,
      "",
      "#### 当前状态",
      "",
      `- 当前阶段：${card.stage}`,
      `- 当前结论：${card.verdict}`,
      `- 原因：${card.reason}`,
      `- 当前责任人：${card.owner}`,
      `- 下一步：${card.nextAction}`,
      "",
      "#### 本次范围",
      "",
      "##### 包含",
      "",
      renderList(item.executionScope?.included),
      "",
      "##### 明确不包含",
      "",
      renderList(item.executionScope?.excluded),
      "",
      "#### 风险判断",
      "",
      `- AI 建议：${item.riskAssessment?.recommendedLevel || "待评估"}`,
      `- 触发因素：${item.riskAssessment?.triggers?.join("、") || "待评估"}`,
      `- 产品确认：${item.riskAssessment?.confirmedLevel || "待确认"}`,
      `- 降级理由：${item.riskAssessment?.downgradeReason || "不适用"}`,
      "",
      "#### 活动进度",
      "",
      "| 活动 | 状态 | 结果或阻断原因 |",
      "|---|---|---|",
    );
    for (const activity of item.activities || []) {
      lines.push(
        `| ${escapeCell(ACTIVITY_LABELS[activity.id] || activity.id)} | ${escapeCell(activity.status)} | ${escapeCell(activity.result || "-")} |`,
      );
    }
    lines.push(
      "",
      "#### 验收与证据",
      "",
      `- 当前产物：${(item.artifacts || []).map((artifact) => artifact.location).join("、") || "无"}`,
      `- 遗留风险：${item.remainingRisks?.join("、") || "无"}`,
      `- 待确认问题：${item.openQuestions?.join("、") || "无"}`,
      "",
      "<details>",
      "<summary>详细任务控制</summary>",
      "",
      `- AI 策略：${item.aiPolicy}`,
      `- 执行状态：${item.executionState}`,
      `- 就绪结论：${deriveReadiness(item)}`,
      "",
      "</details>",
      "",
    );
  }
  return lines.join("\n");
}
