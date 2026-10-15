import {appendKitProgress} from "./kit-progress.js";
import {advanceKitLifecycle} from "./kit-lifecycle.js";

export function acceptKitRequirement(record,{requestId,confirmedBy="产品经理",previewAcknowledged=false,time=new Date().toISOString()}={}){
  if(record.currentStageId!=="awaiting-review"||record.executionState!=="waiting-human"||
    record.workbenchImplementation?.status!=="completed"||record.workbenchAcceptance||
    (record.impactTags?.includes("frontend-page")&&!previewAcknowledged))
    throw Error("ACCEPTANCE_NOT_READY");
  const next=structuredClone(record),ref=`docs/requirements/registry.json#${record.id}.workbenchAcceptance`;
  const review=next.activities.find(activity=>activity.id==="product-review");
  if(!review)throw Error("PRODUCT_REVIEW_MISSING");
  review.status="已完成";review.evidence=[ref,next.workbenchImplementation.changedFiles[0]];
  review.result="产品经理验收通过本轮工程化交付。";
  next.reviewConfirmation={outcome:"approved",continueBuild:false,
    confirmedScope:[...next.workbenchScheme.scope],excludedScope:[...next.workbenchScheme.excluded],
    confirmedRules:next.workbenchScheme.decisions.map(item=>`${item.question}：${item.choice}`),
    nonBlockingQuestions:[],evidenceIds:next.evidence.map(item=>item.id),confirmedBy,confirmedAt:time};
  next.workbenchAcceptance={requestId,confirmedAt:time,confirmedBy,implementationJobId:next.workbenchImplementation.jobId,
    previewAcknowledged,changedFiles:[...next.workbenchImplementation.changedFiles],
    checks:[...next.workbenchImplementation.checks],outcome:"approved"};
  next.currentStageId="completed";next.executionState="completed";next.aiPolicy="human-only";next.waitingReason=null;
  next.artifacts.push({type:"user-confirmation",location:ref,supports:[next.workbenchScheme.acceptance[0]]});
  next.evidence.push({id:`EV-${record.id}-acceptance`,sourceType:"review",location:ref,
    originalClaim:"产品经理查看本轮工程化交付并验收通过。",aiInterpretation:"本轮交付完成，不包含生产上线。",
    scope:"本轮验收",confirmationStatus:"confirmed",occurredAt:time,confirmedBy,confirmedAt:time});
  appendKitProgress(next,{id:`acceptance:${requestId}`,at:time,actor:confirmedBy,action:"验收通过",
    result:"本轮工程化交付完成；不代表生产上线。",authorization:false,nextActor:"无"});
  advanceKitLifecycle(next,"completed",{time,actor:confirmedBy,event:"本轮工程化交付验收通过"});
  return next;
}
