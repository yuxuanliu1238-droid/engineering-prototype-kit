import reviewConfig from "./review-scenarios.json";
export { reviewConfig };
export const NAVIGATION = [
  ["overview", "总", "工作台"],
  ["records", "单", "业务列表"],
  ["rules", "规", "规则配置"],
  ["exceptions", "异", "异常中心"],
];
export const SOURCE_LABELS = {
  "material-explicit": "材料明确",
  "flow-inferred": "流程推导",
  "ai-candidate": "AI 候选",
  "product-confirmed": "产品确认",
};
