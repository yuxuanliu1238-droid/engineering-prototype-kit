import {lifecycleStates,lifecycleLabels} from "./requirement-lifecycle.js";
export const commonLifecycleStages = lifecycleStates.map(id=>({id,label:lifecycleLabels[id]}));

export const requirementTemplates = [{
  id: "frontend-feature",
  name: "新增用户能力",
  description: "适用于用户以前做不到的新操作或新任务；是否影响页面由影响标签决定。",
  deliveryMode: "prototype",
  defaultImpactTags: ["frontend-page", "requirement-document"],
  requiredStages: ["registered", "waiting-start", "impact-analysis", "rule-confirmation", "contract-update", "prototype-update", "page-docs-update", "consistency-check", "user-review", "synced"],
  stages: commonLifecycleStages,
  executionStrategy:{analyze:["用户任务路径","入口与权限","原有能力的关联"],outputs:["能力方案","交互路径","验收场景"],review:"prototype"},
  questionPolicy: {
    ask: ["业务规则", "用户权限", "计算口径", "关键范围", "会改变验收结果的选择"],
    recommend: ["存在业务影响但有明确推荐方案的选择"],
    decide: ["间距与布局微调", "普通空态文案", "常规加载反馈", "视觉一致性", "工程检查方式"],
  },
  prototypeAuthorization: {
    includes: ["受影响的前端原型页面", "对应页面需求说明", "页面契约", "本轮工程化检查"],
    excludes: ["正式研发", "生产接口和数据", "提交、部署和发布", "未确认的其他页面"],
  },
  defaultAcceptance: [
    "主路径可以从入口完整走通，并有明确成功反馈",
    "加载、空数据、失败和重复操作有可恢复反馈",
    "新增业务规则、字段和权限与已确认方案一致",
    "原型、页面需求说明和页面契约保持一致",
    "相关工程化检查通过，且未修改授权范围之外的内容",
  ],
  pageGuideSections: ["目标用户与使用场景", "页面目标", "展示内容", "业务规则", "操作与反馈", "页面状态", "验收要点"],
  evidenceRequirements: ["受影响页面与入口", "业务方案确认记录", "原型制作授权", "原型预览与调整记录", "需求说明和页面契约", "检查结果与最终确认"],
}, {
  id: "existing-page-adjustment",
  name: "现有页面调整",
  description: "适用于现有页面的文案、字段、元素、布局、导航或交互调整；不新增业务状态或核心能力。",
  deliveryMode: "prototype",
  defaultImpactTags: ["frontend-page"],
  requiredStages: ["registered", "waiting-start", "impact-analysis", "rule-confirmation", "prototype-update", "consistency-check", "user-review", "synced"],
  stages: commonLifecycleStages,
  executionStrategy:{analyze:["现有页面与字段","调整前后差异","原有任务路径"],outputs:["页面调整说明","前后对照","回归检查"],review:"prototype"},
  questionPolicy: {
    ask: ["改变现有业务状态含义", "改变权限或计算口径", "删除仍在使用的入口", "改变用户任务路径"],
    recommend: ["会影响用户理解、操作或验收的显示选择"],
    decide: ["字段文案一致性", "留白与布局微调", "现有状态的标签排列", "常规反馈与视觉一致性"],
  },
  prototypeAuthorization: {
    includes: ["受影响的现有原型页面", "对应页面契约或页面说明（确有变化时）", "修改前后对照与工程化检查"],
    excludes: ["新增业务状态或后台逻辑", "正式研发与生产接口", "提交、部署和发布", "未确认的其他页面"],
  },
  defaultAcceptance: [
    "调整后的字段、文案、元素和切换方式与确认方案一致",
    "原有业务状态、计算口径、权限与主要操作保持不变",
    "修改前后可对照，入口、返回和现有交互仍可走通",
    "涉及的页面契约与页面说明同步，未涉及的内容不强制改动",
    "相关原型构建与检查通过，未修改授权范围之外的内容",
  ],
  pageGuideSections: ["调整目标", "修改前与修改后", "保留不变的规则", "展示与交互", "验收要点"],
  evidenceRequirements: ["现有页面与受影响元素", "调整方案确认记录", "原型修改授权", "修改前后对照", "涉及的页面说明与契约", "检查结果与最终确认"],
}, ...[
  {
    id:"business-rule-validation",name:"业务规则与校验调整",description:"判断条件、校验结果或例外处理发生变化。",
    defaultImpactTags:["backend-logic","requirement-document"],
    ask:["生效条件与例外","拒绝后的业务结果","历史业务如何处理"],
    analyze:["现有规则","正反例与判断表","受影响操作"],
    outputs:["规则定义","判断表","核对用例"],
    acceptance:["正反例和例外结果与确认规则一致","现有不受影响的业务路径保持不变","规则说明与核对用例可独立验收"],
  },
  {
    id:"state-data-definition",name:"状态与数据口径调整",description:"状态进入、退出或计算口径发生变化。",
    defaultImpactTags:["state-data","requirement-document"],
    ask:["状态进入与退出条件","历史数据口径","人工改动权限"],
    analyze:["状态路径","数据来源与样例","历史与统计影响"],
    outputs:["状态或口径定义","样例核对","历史影响说明"],
    acceptance:["状态转移或计算样例可复核","历史数据处理边界明确","相关展示或接口支线与同一口径一致"],
  },
  {
    id:"interface-integration",name:"接口与对接变更",description:"调用关系、字段映射、兼容性或失败处理发生变化。",
    defaultImpactTags:["external-interface","requirement-document"],
    ask:["双方责任与调用方向","字段的业务含义","失败与重试边界"],
    analyze:["字段映射","兼容性与异常","联调场景"],
    outputs:["接口变更说明","字段映射","联调核对场景"],
    acceptance:["字段含义与双方责任一致","兼容和异常场景可核对","未把接口联调结果误写成已上线"],
  },
  {
    id:"document-workflow-governance",name:"文档与工作流治理",description:"权威说明、引用关系或协作规则本身需要调整。",
    defaultImpactTags:["requirement-document"],
    ask:["权威来源是哪份","谁确认生效"],
    analyze:["现有版本","引用与冲突","流程影响"],
    outputs:["修订说明","引用更新","一致性检查"],
    acceptance:["权威来源与修订边界明确","受影响引用同步且无冲突","未自动授权其他业务实施"],
  },
].map(profile=>({
  id:profile.id,name:profile.name,description:profile.description,
  deliveryMode:"strategy-artifact",defaultImpactTags:profile.defaultImpactTags,
  requiredStages:["registered","waiting-start","impact-analysis","rule-confirmation","consistency-check","user-review","synced"],
  stages:commonLifecycleStages,
  executionStrategy:{analyze:profile.analyze,outputs:profile.outputs,review:"deliverable"},
  questionPolicy:{ask:profile.ask,recommend:["有业务影响但 AI 有明确建议的选择"],decide:["普通视觉与文案一致性","工程检查方式"]},
  implementationAuthorization:{includes:profile.outputs,excludes:["正式生产开发、部署与发布","未确认的其他需求","未列明的跨项目修改"]},
  defaultAcceptance:profile.acceptance,
  pageGuideSections:[],evidenceRequirements:["原始需求与分析依据","业务方案确认","单独实施授权","本轮交付物与核对结果","最终验收"],
}))];

export const prototypeTemplateIds = new Set(["frontend-feature", "existing-page-adjustment"]);
export function isPrototypeTemplate(id) { return prototypeTemplateIds.has(id); }

export const defaultRequirementTemplateId = "frontend-feature";
export function getRequirementTemplate(id) { return requirementTemplates.find(item => item.id === id) || null; }
export function templateSnapshot(template) { return structuredClone(template); }
