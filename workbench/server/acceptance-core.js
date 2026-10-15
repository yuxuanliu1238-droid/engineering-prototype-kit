import {hash} from "./analysis-core.js";
import {transitionLifecycle} from "../src/requirement-lifecycle.js";

export const ACCEPTANCE_ENDPOINT="/api/analysis/cx-recycle/CR-029/acceptance";
export const acceptanceEndpoint=id=>`/api/analysis/cx-recycle/${id}/acceptance`;
const fail=(message,status=409)=>Object.assign(Error(message),{status});
export function acceptanceReview(record,job){
 const authorization=record?.workbenchImplementationAuthorization;
 const adjustment=(record?.workbenchImplementationAdjustments||[]).findLast(item=>item.authorizationId===authorization?.id)||null;
 const reviewable=!adjustment||adjustment.status==="awaiting-review";
 return {version:hash(record),ready:Boolean(job?.status==="completed"&&authorization?.id===job.authorization?.id&&reviewable&&!record?.workbenchPrototypeAcceptance),accepted:record?.workbenchPrototypeAcceptance?.status==="accepted",adjustment};
}
export function requestAdjustment(record,job,input,time=new Date().toISOString()){
 const review=acceptanceReview(record,job),textValue=typeof input.text==="string"?input.text.trim():"";
 if(input.confirmAdjustmentOnly!==true||!/^[a-f0-9-]{36}$/.test(input.requestId||"")||!textValue||textValue.length>4000)throw fail("请填写调整意见并明确保存。",400);
 const prior=(record.workbenchImplementationAdjustments||[]).find(item=>item.requestId===input.requestId);
 if(prior){if(prior.text!==textValue)throw fail("重复请求内容不同。");return record;}
 if(input.version!==review.version||!review.ready)throw fail("原型结果或确认状态已变化，请刷新后核对。");
 const next=structuredClone(record),authorizationId=next.workbenchImplementationAuthorization.id;
 next.workbenchImplementationAdjustments=[...(next.workbenchImplementationAdjustments||[]),{requestId:input.requestId,authorizationId,text:textValue,createdAt:time,createdBy:"产品经理（本机工作台）",status:"awaiting-authorization"}];
 next.workbenchImplementationAuthorization.status="changes-requested";
 next.taskControl.aiPolicy="planning-only";next.taskControl.executionState="waiting-human";
 next.taskControl.waitingReason={code:"review-required",question:"调整意见已保存，等待继续制作原型。",requestedFrom:"产品经理",impact:"不会覆盖上一轮原型结果。",resumeWhen:"同范围调整直接继续；涉及业务范围变化时返回业务方案确认。"};
 next.stageResults[next.currentStageId]={...next.stageResults[next.currentStageId],status:"waiting_user",recordedAt:time,updatedAt:new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"}),note:"原型验收提出调整，等待授权继续；上一轮结果保留。"};
 next.evidence.push({type:"note",reference:`原型调整 ${input.requestId} · ${time}；原文见 workbenchImplementationAdjustments；同范围调整不重复授权。`});
  return transitionLifecycle(next,"awaiting-review",{time,actor:"产品经理",event:"已提出同范围调整，保留上一轮成果"});
}
export function startAdjustmentRecord(record,adjustmentId,jobId,time=new Date().toISOString()){
 const next=structuredClone(record),adjustment=(next.workbenchImplementationAdjustments||[]).find(item=>item.requestId===adjustmentId);
 if(!adjustment||adjustment.status!=="awaiting-authorization")throw fail("调整事项已变化或已经启动，请刷新核查。");
 adjustment.status="submitted";adjustment.jobId=jobId;adjustment.startedAt=time;
 next.taskControl.aiPolicy="execution-allowed";next.taskControl.executionState="ready";next.taskControl.waitingReason=null;
 next.evidence.push({type:"note",reference:`同范围调整确认并继续 ${adjustmentId} · ${time}；沿用原型制作范围，不扩展业务授权。`});
 return transitionLifecycle(next,"executing",{time,activity:"submitted",actor:"产品经理",event:"同范围调整已确认并继续"});
}
export function acceptPrototypeRecord(record,job,input,time=new Date().toISOString()){
 const review=acceptanceReview(record,job);
 if(input.confirmPrototypeAccepted!==true||!/^[a-f0-9-]{36}$/.test(input.requestId||""))throw fail("需要明确确认原型验收。",400);
 if(input.version!==review.version||!review.ready)throw fail("原型结果或验收状态已变化，请刷新后核对。");
 if(record.workbenchPrototypeAcceptance?.requestId===input.requestId)return record;
 const next=structuredClone(record),date=new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"});
 next.workbenchPrototypeAcceptance={requestId:input.requestId,authorizationId:next.workbenchImplementationAuthorization.id,acceptedAt:time,acceptedBy:"产品经理（本机工作台）",status:"accepted"};
 next.workbenchImplementationAuthorization.status="accepted";
 const adjustment=(next.workbenchImplementationAdjustments||[]).findLast(item=>item.authorizationId===next.workbenchImplementationAuthorization.id);
 if(adjustment?.status==="awaiting-review")adjustment.status="accepted";
 next.currentStageId="synced";
 next.stageResults["user-review"]={status:"completed",updatedAt:date,recordedAt:time,note:"产品经理已在原型预览弹窗确认原型通过。"};
 next.stageResults.synced={status:"completed",updatedAt:date,recordedAt:time,note:"本轮原型验证已完成；未提交、未发布、未接入生产。"};
 next.taskControl.executionState="completed";next.taskControl.aiPolicy="planning-only";next.taskControl.waitingReason=null;
 next.confirmedAt=date;
 const artifactTypes=new Set((next.artifacts||[]).map(item=>item.type));
 const delivered=["交互原型已确认"];
 if(artifactTypes.has("page-guide"))delivered.push("页面需求说明已按授权范围同步");
 if(artifactTypes.has("contract"))delivered.push("页面契约已按授权范围同步");
 if(artifactTypes.has("test-report"))delivered.push("工程化检查已通过");
 next.workbenchPrototypeDelivery={requestId:input.requestId,createdAt:time,createdBy:"产品经理（本机工作台）",status:"completed",sourceAcceptanceId:input.requestId,title:`${record.id} · 工程化原型交付清单`,delivered,boundary:"本轮只交付工程化原型和需求说明，不进入正式开发、部署或发布。",nextAction:"本轮已结束；若需正式开发，请另建需求。"};
 next.artifacts=[...(next.artifacts||[]),{type:"user-confirmation",location:`registry:${record.id}.workbenchPrototypeAcceptance`,supports:["sync-close-gate"],createdAt:date}];
 next.evidence.push({type:"note",reference:`原型验收确认 ${input.requestId} · ${time}；本轮原型验证完成，不授权发布或生产接入。`});
 return transitionLifecycle(next,"completed",{time,actor:"产品经理",event:"原型验收通过，本轮交付完成"});
}
