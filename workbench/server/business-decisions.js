import {hash,ENDPOINT} from "./analysis-core.js";
import {questionReview} from "./question-answers.js";
import {transitionLifecycle} from "../src/requirement-lifecycle.js";
export const DECISIONS_ENDPOINT=`${ENDPOINT}/decisions`;
export const AUTHORIZATION_ENDPOINT=`${ENDPOINT}/authorization`;
export const decisionsEndpoint=id=>`/api/analysis/cx-recycle/${id}/decisions`;
export const authorizationEndpoint=id=>`/api/analysis/cx-recycle/${id}/authorization`;
const reject=message=>Object.assign(Error(message),{status:409});
export const recommendations=[
  {id:"visibility",title:"排行榜可以看到什么",recommendation:"保留丰创登录与身份映射。已登录小哥可查看前三名的姓名、累计有效激励和有效订单数；不展示手机号，不允许进入他人的订单或激励明细。",impact:"仅为排行榜增加有限展示例外，其他本人数据限制不变。",context:"你已在对话认可；仍需在这里保存到台账。"},
  {id:"orders",title:"哪些订单计入排行",recommendation:"满足现行激励资格且成功计算的订单计入，包含合法0元结果；排除待计算、计算异常和不发放。按业务订单唯一标识去重。",impact:"0元可增加有效订单数，但不会增加金额；异常不能当作0元成功。"},
  {id:"ranking",title:"同金额怎么排",recommendation:"累计有效激励降序，其次有效订单数降序。两项相同则并列，名次采用1、1、3；工号升序稳定展示。首页最多展示三人，第三名并列时仍按工号截取。",impact:"并列不增加首页展示人数；零金额不参榜。工号唯一性与比较规则不影响本轮原型判断，留待正式开发前核查。"},
  {id:"inactive",title:"停用人员的历史业绩",recommendation:"停用不影响原归属有效业绩统计和排名资格，包括停用后才成功计算的原归属订单；不恢复停用账号访问权限。",impact:"停用人员仍可能占据前三名席位。"}
];
const checkLabels={"goal-clear":"目标明确","scope-clear":"范围明确","acceptance-testable":"验收标准可验证","dependencies-clear":"数据源与依赖明确","rules-confirmed":"规则与契约已核对","risk-reviewed":"风险已审阅"};
export function recommendationsFor(record,answers){
  if(record.id==="CR-029")return recommendations;
  const cards=[
    {id:"scope",title:"本轮做什么",recommendation:answers.scopeBasis.scope.join("；")||"按需求描述确认本轮页面范围。",impact:"决定本轮会制作哪些页面和交互，不包含范围外顺带修改。"},
    ...answers.questions.map((item,index)=>({id:`answer-${index+1}`,title:item.text,recommendation:item.answer,impact:"采用你已保存的业务回答，作为本轮原型规则。"})),
    {id:"acceptance",title:"如何判断原型符合需求",recommendation:(record.workbenchAnalysis?.result?.acceptance||[]).join("；"),impact:"确认后作为原型预览和最终验收依据。"},
  ];
  return cards.filter(item=>item.recommendation?.trim());
}
export function businessReview(record){
  const answers=questionReview(record);
  const proposals=recommendationsFor(record,answers);
  const basis=hash([answers.analysisId,answers.resultHash,answers.answersDigest,answers.scopeBasis,proposals]);
  const receipt=record.workbenchBusinessDecisions?.findLast(item=>item.basis===basis)||null;
  const eligible=answers.canAnswer&&(!answers.questions.length||Boolean(answers.submission));
  const blockers=[];
  if(!eligible)blockers.push("请先整理范围并提交当前回答");
  if(!receipt)blockers.push("请确认本轮业务方案");
  if(receipt?.items.some(item=>item.choice==="custom"))blockers.push("修改后的业务意见需由 AI 再次核对");
  for(const [id,label]of Object.entries(checkLabels)){const check=record.taskControl?.readinessChecklist.find(item=>item.id===id);if(check?.status!=="met"||!check.evidence?.length)blockers.push(label);}
  if(record.pendingQuestions?.length)blockers.push("台账仍有未解决事项");
  // Formal development is outside this workflow. Prototype authorization remains a separate gate.
  blockers.push(record.workbenchTemplate?.deliveryMode==="strategy-artifact"?"尚未单独授权整理本轮需求成果":"尚未单独授权制作工程化原型");
  const legacyDesign=["紧凑布局、加载态和失败态由 AI 设计，不逐项提问。","不足三人保留空位；无人显示“暂无排行”，本人无排名显示“暂未上榜”。","10分钟为刷新建议，展示更新时间；失败时明确标记旧数据。"];
  return {version:hash(record),basis,eligible,recommendations:proposals,receipt,canAuthorize:false,blockers,
    plan:{title:`${record.id} · ${record.title}`,project:"cx回收",scope:record.workbenchScopeConfirmation?.scope||[],excluded:record.workbenchScopeConfirmation?.excluded||[],acceptance:record.workbenchAnalysis.result.acceptance,label:record.workbenchTemplate?.deliveryMode==="strategy-artifact"?"只确认业务方案；随后仍需单独授权整理本轮需求成果。":"只确认业务方案；随后仍需单独授权制作原型。"},
    delegatedDesign:record.id==="CR-029"?legacyDesign:(record.workbenchTemplate?.questionPolicy?.decide||[]).map(text=>`${text}由 AI 处理，不逐项提问。`),
    engineeringChecks:record.id==="CR-029"?["数据口径和业务订单唯一标识","时间范围、跨期订单及演示数据排除","页面刷新、旧数据提示和失败反馈","确认业务方案后同步页面说明与验收样例"]:(record.workbenchTemplate?.defaultAcceptance||[])};
}
export function saveBusinessDecisions(record,input,time=new Date().toISOString()){
  const review=businessReview(record),answers=questionReview(record);
  if(!review.eligible||input.confirmDecisionsOnly!==true||input.basis!==review.basis)throw reject("范围或回答已变化，请刷新后核对。确认业务方案不等于授权制作原型。");
  if(!/^[a-f0-9-]{36}$/.test(input.requestId||""))throw reject("缺少有效保存标识。");
  if(!Array.isArray(input.items)||input.items.length!==review.recommendations.length)throw reject("请逐项选择采纳建议或修改意见。");
  const items=review.recommendations.map(proposal=>{const matches=input.items.filter(item=>item?.id===proposal.id);const value=matches[0];if(matches.length!==1||!["adopt","custom"].includes(value.choice))throw reject("请逐项明确选择。");if(value.choice==="custom"&&(typeof value.text!=="string"||!value.text.trim()||value.text.length>2000))throw reject("请填写1–2000字修改意见。");return {id:proposal.id,title:proposal.title,choice:value.choice,text:value.choice==="adopt"?proposal.recommendation:value.text};});
  const prior=record.workbenchBusinessDecisions?.find(item=>item.requestId===input.requestId);
  if(prior){if(prior.basis!==review.basis||hash(prior.items)!==hash(items))throw reject("重复请求内容不同。");return record;}
  if(input.version!==review.version)throw reject("台账已变化。输入已保留，请刷新后核对再保存。");
  const next=structuredClone(record);
  next.workbenchScopeConfirmation={id:input.requestId,analysisId:answers.analysisId,resultHash:answers.resultHash,confirmedAt:time,confirmedBy:"产品经理（本机工作台）",scope:[...answers.scopeBasis.scope],excluded:[...answers.scopeBasis.excluded],unresolvedQuestions:[],implementationAuthorized:false,confirmedWithBusinessDecision:true};
  next.workbenchBusinessDecisions=[...(record.workbenchBusinessDecisions||[]),{requestId:input.requestId,basis:review.basis,confirmedAt:time,confirmedBy:"产品经理（本机工作台）",items,implementationAuthorized:false}];
  const readinessEvidence={
    "scope-clear":`业务方案 ${input.requestId} 已确认本轮范围`,
    "acceptance-testable":`业务方案 ${input.requestId} 已确认验收标准`,
    "dependencies-clear":`业务方案 ${input.requestId} 已记录依赖与非生产边界`,
    "rules-confirmed":`业务方案 ${input.requestId} 已保存业务规则`,
    "risk-reviewed":`业务方案 ${input.requestId} 采用模板风险边界；授权时仍需再次核对精确文件范围`,
  };
  next.taskControl.readinessChecklist=next.taskControl.readinessChecklist.map(check=>readinessEvidence[check.id]?{...check,status:"met",evidence:[readinessEvidence[check.id]]}:check);
  next.pendingQuestions=[];
  next.stageResults[next.currentStageId]={...next.stageResults[next.currentStageId],recordedAt:time,note:"业务方案已确认；仍需单独授权制作原型。"};
  next.evidence.push({type:"note",reference:`业务方案确认 ${input.requestId} · ${time}；包含范围、业务规则与验收依据；不授权正式研发。`});
  const analyzed=next.workbenchLifecycle?.state==="awaiting-analysis"
    ? transitionLifecycle(next,"awaiting-plan",{time,actor:"AI 执行端",event:"需求分析成果已形成，待确认方案"})
    : next;
  return transitionLifecycle(analyzed,"awaiting-authorization",{time,actor:"产品经理",event:"业务方案已确认；尚未授权执行"});
}
export function authorizeImplementation(){throw reject("原型制作条件尚未就绪，未保存授权、未开始制作。");}
