import {
  acceptance,
  action,
  dataField,
  makePage,
  rule,
  section,
  state,
} from "../builders.js";

export const starterHome = makePage({
  pageId: "starter.home",
  surface: "web",
  title: "工程化原型启动页",
  goal: "帮助产品经理核对资料准备情况并获得第一条启动提示。",
  implementationStatus: "implemented",
  preview: {
    entry: "index.html",
    defaultStateId: "starter.home.not-ready",
  },
  sections: [
    section("starter.home.hero", "启动说明", "说明启动包目标和 Codex 启动提示。"),
    section(
      "starter.home.readiness",
      "开始前核对",
      "让用户确认资料、敏感信息和原型边界。",
    ),
    section("starter.home.workflow", "阶段总览", "展示工程化原型八个阶段。"),
  ],
  actions: [
    action("starter.home.toggle-readiness", "切换准备项", "点击任一准备项", {
      preconditions: ["页面已加载"],
      validations: ["准备项必须来自固定清单"],
      successResult: "目标准备项在选中和未选中之间切换。",
      dataEffects: ["只更新当前页面本地状态，不持久化业务数据"],
      failureHandling: "保持原状态，不影响其他准备项。",
    }),
  ],
  states: [
    state("starter.home.not-ready", "尚未准备完成", {
      enterWhen: "至少一个准备项未选中。",
      visibleChanges: "显示已完成数量和继续核对提示。",
      allowedActionIds: ["starter.home.toggle-readiness"],
      recovery: "补齐全部准备项。",
    }),
    state("starter.home.ready", "准备完成", {
      enterWhen: "三个准备项全部选中。",
      visibleChanges: "卡片上移并显示可以开始业务探索。",
      allowedActionIds: ["starter.home.toggle-readiness"],
      recovery: "取消任一准备项后回到尚未准备完成。",
    }),
  ],
  rules: [
    rule(
      "starter.home.rule.no-business-facts",
      "scope",
      "启动页是中性占位页，不定义任何项目业务规则。",
    ),
  ],
  dataFields: [
    dataField(
      "starter.home.field.readiness",
      "准备项选中状态",
      "当前页面本地状态",
      true,
      "判断是否显示准备完成提示",
      "internal",
    ),
  ],
  integrations: [],
  exceptions: [],
  acceptanceCriteria: [
    acceptance(
      "starter.home.acceptance.initial",
      "用户首次打开启动页",
      "未点击准备项",
      "页面显示 0/3，且不宣称项目已准备完成。",
    ),
    acceptance(
      "starter.home.acceptance.ready",
      "三个准备项都已确认",
      "用户选中最后一项",
      "页面显示 3/3，并提示可以开始业务探索。",
    ),
    acceptance(
      "starter.home.acceptance.recovery",
      "页面处于准备完成状态",
      "用户取消任一准备项",
      "页面恢复为尚未准备完成状态。",
    ),
  ],
});
