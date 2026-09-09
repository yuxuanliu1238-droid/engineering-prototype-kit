import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  MATERIAL_TYPE_LABELS,
  MATERIAL_ROLE_LABELS,
  BASELINE_STATE_LABELS,
  ENGINEERING_DOMAIN_LABELS,
  DIRECTION_LABELS,
  CONFIRMATION_LABELS,
  HANDOFF_STATUS_LABELS,
  SCOPE_DISPOSITION_LABELS,
  CHANGE_TYPE_LABELS,
} from "./model.mjs";
import { analyzeHandoffCoverage } from "./coverage.mjs";

export function escapeCell(value) {
  return String(value ?? "-")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, "<br>");
}

export function list(values, empty = "无") {
  return values?.length ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

export function join(values, empty = "-") {
  return values?.length ? values.join("；") : empty;
}

export function renderTable(headers, rows) {
  const lines = [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`];
  if (!rows.length) {
    lines.push(`| ${headers.map((_, index) => (index === 0 ? "暂无" : "-")).join(" | ")} |`);
  } else {
    for (const row of rows) lines.push(`| ${row.map(escapeCell).join(" | ")} |`);
  }
  return lines.join("\n");
}

export function taskMaterialText(task, materialsById) {
  const materials = (task.materialRefs || []).map((reference) => {
    const material = materialsById.get(reference.materialId);
    const section = reference.section || material?.section;
    return `${material?.title || reference.materialId}${section ? `／${section}` : ""}`;
  });
  return join([...materials, ...(task.reviewBasis || [])]);
}

export function taskRows(data, type, materialsById) {
  const tasks = (data.tasks || []).filter((task) => task.type === type);
  tasks.sort((left, right) => {
    function key(task) {
      if (type === "application-feature") {
        return [
          task.application?.application,
          ...(task.application?.menuPath || []),
          task.application?.page,
          task.application?.operation,
          task.id,
        ].join("\u0000");
      }
      if (type === "external-integration") {
        return [
          task.integration?.systemParty,
          task.integration?.interfaceName,
          task.integration?.triggerScenario,
          task.id,
        ].join("\u0000");
      }
      return [task.nonPage?.category, task.nonPage?.triggerScenario, task.id].join("\u0000");
    }
    return key(left).localeCompare(key(right), "zh-CN");
  });
  return tasks.map((task) => {
    const common = {
      domains: join(
        (task.engineeringDomains || []).map(
          (domain) => ENGINEERING_DOMAIN_LABELS[domain] || domain,
        ),
      ),
      requirements: join(task.requirementIds),
      acceptance: join(task.acceptanceCriteria),
      prerequisites: join(task.prerequisites),
      materials: taskMaterialText(task, materialsById),
    };
    if (type === "application-feature") {
      return [
        task.id,
        task.application?.application,
        [...(task.application?.menuPath || []), task.application?.page].filter(Boolean).join("／"),
        task.application?.operation,
        task.developmentScope,
        common.domains,
        common.requirements,
        common.acceptance,
        common.prerequisites,
        common.materials,
      ];
    }
    if (type === "external-integration") {
      return [
        task.id,
        task.integration?.systemParty,
        task.integration?.interfaceName,
        DIRECTION_LABELS[task.integration?.direction] || task.integration?.direction,
        task.integration?.triggerScenario,
        task.developmentScope,
        common.requirements,
        common.acceptance,
        common.prerequisites,
        common.materials,
      ];
    }
    return [
      task.id,
      task.nonPage?.category,
      task.nonPage?.triggerScenario,
      task.developmentScope,
      common.domains,
      common.requirements,
      common.acceptance,
      common.prerequisites,
      common.materials,
    ];
  });
}

export function renderDevelopmentTaskList(data) {
  const materialsById = new Map((data.materials || []).map((material) => [material.id, material]));
  const coverage = analyzeHandoffCoverage(data);
  const product = data.confirmations?.product || {};
  const engineering = data.confirmations?.engineering || {};
  const lines = [
    `# ${data.title || "研发任务清单"}`,
    "",
    "<!-- 本文件由结构化研发任务台账确定性生成，请勿直接编辑。 -->",
    "",
    "> 本清单只定义经评审确认的开发范围，不承担负责人、工期、进度和完成比例管理。",
    "",
    "## 1. 清单信息",
    "",
    renderTable(
      ["项目", "内容"],
      [
        ["清单编号", data.listId],
        ["清单版本", data.version],
        ["当前状态", HANDOFF_STATUS_LABELS[data.status] || data.status],
        ["交接范围", data.handoffScope?.summary],
        [
          "当前版本变化",
          `${CHANGE_TYPE_LABELS[data.currentRevision?.changeType] || data.currentRevision?.changeType}：${data.currentRevision?.summary}`,
        ],
        [
          "产品确认",
          `${CONFIRMATION_LABELS[product.decision] || product.decision}${product.confirmedBy ? `，${product.confirmedBy}，${product.confirmedAt}` : ""}`,
        ],
        [
          "研发确认",
          `${CONFIRMATION_LABELS[engineering.decision] || engineering.decision}${engineering.confirmedBy ? `，${engineering.confirmedBy}，${engineering.confirmedAt}` : ""}`,
        ],
      ],
    ),
    "",
    "### 本轮需求范围",
    "",
    renderTable(
      ["需求编号", "需求", "处理结论", "说明"],
      (data.handoffScope?.requirements || []).map((requirement) => [
        requirement.id,
        requirement.title,
        SCOPE_DISPOSITION_LABELS[requirement.disposition] || requirement.disposition,
        requirement.reason || "-",
      ]),
    ),
    "",
    "### 明确非范围",
    "",
    list(data.explicitExclusions),
    "",
    "### 会改变业务结果的待确认问题",
    "",
    (data.businessOpenQuestions || []).length
      ? (data.businessOpenQuestions || [])
          .map(
            (item) =>
              `- ${item.question}（确认方：${item.requestedFrom}；影响：${item.impact}；恢复条件：${item.resumeWhen}）`,
          )
          .join("\n")
      : "- 无",
    "",
    "### 实施前置条件",
    "",
    renderTable(
      ["前置条件", "责任方", "影响", "满足条件"],
      (data.implementationPrerequisites || []).map((item) => [
        item.item,
        item.owner,
        item.impact,
        item.readyWhen,
      ]),
    ),
    "",
    "## 2. 公共材料入口",
    "",
    renderTable(
      ["编号", "用途", "材料", "位置", "相关章节", "评审基线"],
      (data.materials || []).map((material) => [
        material.id,
        MATERIAL_ROLE_LABELS[material.role] || material.role,
        `${MATERIAL_TYPE_LABELS[material.type] || material.type}：${material.title}`,
        material.locator,
        material.section || "-",
        `${BASELINE_STATE_LABELS[material.baselineState] || material.baselineState}${material.revisionLabel ? `：${material.revisionLabel}` : ""}${material.baselineState === "manual-confirmed" ? `：${material.confirmedBy}，${material.confirmedAt}` : ""}`,
      ]),
    ),
    "",
    "## 3. 应用功能任务",
    "",
    renderTable(
      [
        "任务编号",
        "应用端",
        "菜单／页面",
        "功能操作",
        "开发范围",
        "涉及研发端",
        "关联需求",
        "验收要点",
        "实施前置条件",
        "关联材料／评审依据",
      ],
      taskRows(data, "application-feature", materialsById),
    ),
    "",
    "## 4. 外部系统接口任务",
    "",
    renderTable(
      [
        "任务编号",
        "系统方",
        "接口名称",
        "对接方向",
        "调用场景",
        "开发范围",
        "关联需求",
        "异常与验收",
        "依赖／待确认",
        "关联材料／评审依据",
      ],
      taskRows(data, "external-integration", materialsById),
    ),
    "",
    "## 5. 非页面研发任务",
    "",
    renderTable(
      [
        "任务编号",
        "任务分类",
        "触发场景",
        "开发范围",
        "涉及研发端",
        "关联需求",
        "验收要点",
        "实施前置条件",
        "关联材料／评审依据",
      ],
      taskRows(data, "non-page", materialsById),
    ),
    "",
    "## 6. 完整性检查",
    "",
    renderTable(
      ["检查", "结果", "说明"],
      coverage.map((check) => [
        check.label,
        check.status === "passed" ? "通过" : "未通过",
        check.detail,
      ]),
    ),
    "",
    "> 检查只证明已声明范围存在映射；研发任务是否技术完整，仍以研发负责人确认为准。",
    "",
    "## 7. 版本记录",
    "",
    renderTable(
      ["版本", "变更类型", "摘要", "记录时间"],
      (data.versionHistory || []).map((revision) => [
        revision.version,
        CHANGE_TYPE_LABELS[revision.changeType] || revision.changeType,
        revision.summary,
        revision.recordedAt,
      ]),
    ),
    "",
  ];
  return lines.join("\n");
}

export function summarizeTaskTypes(data) {
  const counts = Object.fromEntries(TASK_TYPES.map((type) => [type, 0]));
  for (const task of data.tasks || []) {
    if (Object.hasOwn(counts, task.type)) counts[task.type] += 1;
  }
  return TASK_TYPES.map((type) => `${TASK_TYPE_LABELS[type]} ${counts[type]} 项`).join("、");
}
