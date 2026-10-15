import {hash} from "./analysis-core.js";
import {transitionLifecycle} from "../src/requirement-lifecycle.js";

const fail=(message,status=409)=>Object.assign(Error(message),{status});
export function strategyAcceptanceReview(record,job){
  const authorization=record?.workbenchImplementationAuthorization,delivery=record?.workbenchStrategyDelivery;
  return {version:hash(record),ready:Boolean(record?.workbenchTemplate?.deliveryMode==="strategy-artifact"&&
    job?.status==="completed"&&authorization?.id===job.authorization?.id&&
    authorization?.status==="awaiting-review"&&delivery?.status==="awaiting-review"&&
    !record?.workbenchStrategyAcceptance),accepted:record?.workbenchStrategyAcceptance?.status==="accepted",delivery};
}

export function acceptStrategyArtifactRecord(record,job,input,time=new Date().toISOString()){
  const review=strategyAcceptanceReview(record,job);
  if(input.confirmStrategyAccepted!==true||!/^[a-f0-9-]{36}$/.test(input.requestId||""))throw fail("请明确验收本轮需求成果。",400);
  if(record.workbenchStrategyAcceptance?.requestId===input.requestId)return record;
  if(input.version!==review.version||!review.ready)throw fail("成果或验收状态已变化，请刷新后核对。");
  const next=structuredClone(record),date=new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"});
  next.workbenchStrategyAcceptance={requestId:input.requestId,status:"accepted",acceptedAt:time,
    acceptedBy:"产品经理（本机工作台）",authorizationId:next.workbenchImplementationAuthorization.id};
  next.workbenchStrategyDelivery.status="accepted";
  next.workbenchImplementationAuthorization.status="accepted";
  next.currentStageId="synced";next.confirmedAt=date;
  next.stageResults["user-review"]={status:"completed",updatedAt:date,recordedAt:time,note:"产品经理已验收本轮需求成果。"};
  next.stageResults.synced={status:"completed",updatedAt:date,recordedAt:time,note:"本轮需求成果完成；未进行生产开发、部署或发布。"};
  next.taskControl.executionState="completed";next.taskControl.aiPolicy="planning-only";next.taskControl.waitingReason=null;
  next.artifacts=[...(next.artifacts||[]),{type:"user-confirmation",location:`registry:${next.id}.workbenchStrategyAcceptance`,supports:["sync-close-gate"],createdAt:date}];
  next.evidence.push({type:"note",reference:`需求成果验收 ${input.requestId} · ${time}；本轮完成，未授权正式研发或生产上线。`});
  return transitionLifecycle(next,"completed",{time,actor:"产品经理",event:"需求成果验收通过，本轮完成"});
}
