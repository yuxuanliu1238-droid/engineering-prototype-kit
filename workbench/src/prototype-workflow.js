export const prototypeWorkflow={
  boundary:"工程化原型与需求说明",
  excluded:["正式研发","生产接口接入","发布上线","监控与灰度"],
  manualGates:[
    {id:"business",label:"确认业务方案",meaning:"确认业务规则、范围与验收标准；不制作原型"},
    {id:"prototype-authorization",label:"授权制作原型",meaning:"允许 AI 在本轮白名单内制作工程化原型"},
    {id:"prototype-acceptance",label:"确认原型并完成本轮",meaning:"确认原型和需求说明符合本轮目标"}
  ],
  stages:[
    {id:"intake",label:"待分析",primaryAction:"让 AI 分析需求"},
    {id:"business-review",label:"待确认业务方案",primaryAction:"确认业务方案"},
    {id:"prototype-authorization",label:"待授权制作原型",primaryAction:"授权制作原型"},
    {id:"prototype-building",label:"AI 正在制作原型",primaryAction:null},
    {id:"prototype-review",label:"待预览确认",primaryAction:"预览原型"},
    {id:"completed",label:"工程化原型已完成",primaryAction:"查看原型交付清单"}
  ],
  questionPolicy:{
    ask:"只有会改变业务规则、用户权益、数据口径、页面范围或验收结果的问题才询问产品经理",
    recommend:"有明确默认方案但会影响业务结果时，展示 AI 建议及影响",
    decide:"布局、间距、普通交互反馈和工程检查等常规事项由 AI 处理，不转成产品问卷"
  }
};

export function validatePrototypeWorkflow(model=prototypeWorkflow){
  const labels=model.manualGates.map(item=>item.label);
  if(labels.length!==3||new Set(labels).size!==3)throw Error("人工确认点必须且只能有三个");
  if(!labels.includes("确认业务方案")||!labels.includes("授权制作原型")||!labels.includes("确认原型并完成本轮"))throw Error("缺少必要人工确认点");
  if(model.excluded.some(item=>!item))throw Error("边界说明不能为空");
  return true;
}
