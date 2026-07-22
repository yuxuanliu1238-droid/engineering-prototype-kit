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
    section(
      "starter.home.task-control",
      "任务控制演示",
      "通过 AI 策略和就绪检查确定性生成可执行结论。",
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
    action("starter.home.set-ai-policy", "选择 AI 策略", "点击仅规划或允许实施", {
      preconditions: ["页面已加载"],
      validations: ["策略只能为 planning-only 或 execution-allowed"],
      successResult: "更新 AI 策略并重新推导就绪结论。",
      dataEffects: ["只更新当前页面演示状态"],
      failureHandling: "保持原策略。",
    }),
    action("starter.home.toggle-task-check", "切换任务检查项", "点击任一就绪检查项", {
      preconditions: ["页面已加载"],
      validations: ["检查项必须来自固定演示清单"],
      successResult: "更新检查项并重新推导就绪结论。",
      dataEffects: ["只更新当前页面演示状态"],
      failureHandling: "保持原检查状态。",
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
    state("starter.home.task-needs-input", "任务未就绪", {
      enterWhen: "AI 策略和检查项未满足规划或实施条件。",
      visibleChanges: "显示 needs-input 和 locked。",
      allowedActionIds: [
        "starter.home.set-ai-policy",
        "starter.home.toggle-task-check",
      ],
      recovery: "补齐对应策略所需检查项。",
    }),
    state("starter.home.task-planning-ready", "任务可规划", {
      enterWhen: "AI 策略为 planning-only 且目标明确。",
      visibleChanges: "显示 planning-ready 和 ready，并提示不得修改目标文件。",
      allowedActionIds: [
        "starter.home.set-ai-policy",
        "starter.home.toggle-task-check",
      ],
      recovery: "改变 AI 策略或取消目标检查。",
    }),
    state("starter.home.task-execution-ready", "任务可实施", {
      enterWhen: "AI 策略为 execution-allowed 且四个演示检查项全部满足。",
      visibleChanges: "显示 execution-ready 和 ready。",
      allowedActionIds: [
        "starter.home.set-ai-policy",
        "starter.home.toggle-task-check",
      ],
      recovery: "取消任一检查项或改为仅规划。",
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
    dataField(
      "starter.home.field.ai-policy",
      "AI 策略",
      "当前页面演示状态",
      true,
      "推导任务是否可规划或可实施",
      "internal",
    ),
    dataField(
      "starter.home.field.task-readiness",
      "任务就绪检查",
      "当前页面演示状态",
      true,
      "确定性推导 readiness verdict",
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
    acceptance(
      "starter.home.acceptance.planning-ready",
      "AI 策略为仅规划",
      "用户选中目标明确",
      "显示 planning-ready，并明确不得修改目标文件。",
    ),
    acceptance(
      "starter.home.acceptance.execution-ready",
      "AI 策略为允许实施",
      "用户完成四个演示检查项",
      "显示 execution-ready 和 ready。",
    ),
    acceptance(
      "starter.home.acceptance.authorization-is-not-readiness",
      "AI 策略为允许实施但检查项不完整",
      "用户查看推导结果",
      "仍显示 needs-input 和 locked。",
    ),
  ],
});
