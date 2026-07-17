import { assertObject, hasText, requireStringArray } from "./project-lib.mjs";

export const EXPECTED_STAGE_IDS = [
  "registered",
  "waiting-start",
  "impact-analysis",
  "rule-confirmation",
  "decision-record",
  "page-contract",
  "interactive-prototype",
  "page-spec",
  "consistency-check",
  "user-review",
  "synced",
];

export const EXPECTED_NODE_STATUSES = [
  "未开始",
  "进行中",
  "等待用户",
  "已完成",
  "已跳过",
  "被阻塞",
];

export function deriveOverallStatus(currentStageId) {
  if (currentStageId === "waiting-start") return "未同步";
  if (currentStageId === "synced") return "已同步";
  return "同步中";
}

export function validateRegistryData(registry) {
  const errors = [];
  if (!assertObject(registry, "需求台账", errors)) return errors;
  if (registry.schemaVersion !== 1) errors.push("需求台账 schemaVersion 必须为 1");

  if (!Array.isArray(registry.stageDefinitions)) {
    errors.push("stageDefinitions 必须是数组");
  } else {
    const actual = registry.stageDefinitions.map((stage) => stage.id);
    if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_STAGE_IDS)) {
      errors.push("流程节点顺序或编号与固定流程不一致");
    }
    registry.stageDefinitions.forEach((stage, index) => {
      if (!assertObject(stage, `stageDefinitions[${index}]`, errors)) return;
      if (!hasText(stage.label)) errors.push(`stageDefinitions[${index}].label 缺失`);
      if (typeof stage.required !== "boolean") {
        errors.push(`stageDefinitions[${index}].required 必须是布尔值`);
      }
    });
  }

  if (JSON.stringify(registry.nodeStatuses) !== JSON.stringify(EXPECTED_NODE_STATUSES)) {
    errors.push("节点状态集合与固定定义不一致");
  }

  if (!Array.isArray(registry.items)) {
    errors.push("items 必须是数组");
    return errors;
  }

  const ids = new Set();
  registry.items.forEach((item, index) => {
    const label = `items[${index}]`;
    if (!assertObject(item, label, errors)) return;
    if (!/^CR-\d{3}$/.test(item.id || "")) errors.push(`${label}.id 必须形如 CR-001`);
    if (ids.has(item.id)) errors.push(`CR 编号重复：${item.id}`);
    ids.add(item.id);

    for (const field of ["summary", "originalRequest", "source", "proposedAt"]) {
      if (!hasText(item[field])) errors.push(`${label}.${field} 缺失`);
    }
    if (!EXPECTED_STAGE_IDS.includes(item.currentStageId)) {
      errors.push(`${label}.currentStageId 无效`);
    }
    for (const field of ["pageIds", "actionIds", "stateIds", "documents", "evidence"]) {
      requireStringArray(item[field], `${label}.${field}`, errors);
    }
    if (!Array.isArray(item.nodes)) errors.push(`${label}.nodes 必须是数组`);
    else {
      const nodeIds = item.nodes.map((node) => node.stageId);
      if (JSON.stringify(nodeIds) !== JSON.stringify(EXPECTED_STAGE_IDS)) {
        errors.push(`${label}.nodes 必须覆盖固定流程并保持顺序`);
      }
      item.nodes.forEach((node, nodeIndex) => {
        if (!EXPECTED_NODE_STATUSES.includes(node.status)) {
          errors.push(`${label}.nodes[${nodeIndex}].status 无效`);
        }
      });
    }

    const stageIndex = EXPECTED_STAGE_IDS.indexOf(item.currentStageId);
    const impactIndex = EXPECTED_STAGE_IDS.indexOf("impact-analysis");
    if (
      stageIndex < impactIndex &&
      [...(item.pageIds || []), ...(item.actionIds || []), ...(item.stateIds || [])].length
    ) {
      errors.push(`${item.id} 尚未完成影响分析，不得预填 Page、Action 或 State ID`);
    }

    if (item.currentStageId === "synced") {
      if (!hasText(item.userConfirmationDate)) {
        errors.push(`${item.id} 已同步但缺少 userConfirmationDate`);
      }
      const reviewNode = (item.nodes || []).find((node) => node.stageId === "user-review");
      if (reviewNode?.status !== "已完成") {
        errors.push(`${item.id} 已同步但用户评审节点未完成`);
      }
      if (!(item.evidence || []).length) errors.push(`${item.id} 已同步但缺少证据`);
    }

    if (
      hasText(item.overallStatus) &&
      item.overallStatus !== deriveOverallStatus(item.currentStageId)
    ) {
      errors.push(`${item.id}.overallStatus 必须由 currentStageId 确定性推导`);
    }
  });

  return errors;
}

export function renderRequirements(registry) {
  const lines = [
    "# 需求池",
    "",
    "<!-- 此文件由 docs/requirements/registry.json 确定性生成，请勿直接编辑。 -->",
    "",
  ];
  if (!registry.items.length) {
    lines.push("当前没有已登记的增量需求。", "");
    return lines.join("\n");
  }
  lines.push("| 编号 | 需求一句话 | 提出时间 | 状态 | 当前节点 |", "|---|---|---|---|---|");
  for (const item of registry.items) {
    lines.push(
      `| ${item.id} | ${item.summary.replaceAll("|", "\\|")} | ${item.proposedAt} | ${deriveOverallStatus(item.currentStageId)} | ${item.currentStageId} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
