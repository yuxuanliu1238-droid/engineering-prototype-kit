import { asArray, isObject } from "./model.mjs";

export function analyzeHandoffCoverage(data) {
  const tasks = asArray(data?.tasks).filter(isObject);
  const requirements = asArray(data?.handoffScope?.requirements).filter(isObject);
  const applicationItems = asArray(data?.handoffScope?.applicationItems).filter(isObject);
  const integrationItems = asArray(data?.handoffScope?.integrationItems).filter(isObject);

  const mappedRequirementIds = new Set(tasks.flatMap((task) => task.requirementIds || []));
  const mappedApplicationIds = new Set(
    tasks
      .filter((task) => task.type === "application-feature")
      .flatMap((task) => task.scopeItemIds || []),
  );
  const mappedIntegrationIds = new Set(
    tasks
      .filter((task) => task.type === "external-integration")
      .flatMap((task) => task.scopeItemIds || []),
  );

  const missingRequirements = requirements
    .filter(
      (item) => item.disposition === "development-required" && !mappedRequirementIds.has(item.id),
    )
    .map((item) => item.id);
  const missingApplicationItems = applicationItems
    .filter(
      (item) => item.disposition === "development-required" && !mappedApplicationIds.has(item.id),
    )
    .map((item) => item.id);
  const missingIntegrationItems = integrationItems
    .filter(
      (item) => item.disposition === "development-required" && !mappedIntegrationIds.has(item.id),
    )
    .map((item) => item.id);
  const untraceableTasks = tasks
    .filter((task) => !(task.requirementIds || []).length && !task.technicalBasis)
    .map((task) => task.id || "未命名任务");

  return [
    {
      id: "requirement-coverage",
      label: "需求覆盖",
      status: missingRequirements.length ? "failed" : "passed",
      detail: missingRequirements.length
        ? `未覆盖：${missingRequirements.join("、")}`
        : "所有需研发改动的需求均已映射",
    },
    {
      id: "application-coverage",
      label: "原型与应用功能覆盖",
      status: missingApplicationItems.length ? "failed" : "passed",
      detail: missingApplicationItems.length
        ? `未覆盖：${missingApplicationItems.join("、")}`
        : "所有已声明应用端、菜单、页面和操作均已映射",
    },
    {
      id: "integration-coverage",
      label: "外部系统接口覆盖",
      status: missingIntegrationItems.length ? "failed" : "passed",
      detail: missingIntegrationItems.length
        ? `未覆盖：${missingIntegrationItems.join("、")}`
        : "所有需研发改动的外部系统接口均已映射",
    },
    {
      id: "task-traceability",
      label: "任务反查",
      status: untraceableTasks.length ? "failed" : "passed",
      detail: untraceableTasks.length
        ? `无有效来源：${untraceableTasks.join("、")}`
        : "每个任务均可回溯到需求或研发确认的技术必要项",
    },
  ];
}
