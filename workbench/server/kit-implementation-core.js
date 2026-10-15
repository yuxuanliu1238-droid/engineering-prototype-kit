import {appendKitProgress} from "./kit-progress.js";
import {advanceKitLifecycle,ensureKitLifecycle} from "./kit-lifecycle.js";

const reviewReason={code:"review-required",question:"请查看本轮交付物并决定是否验收。",
  requestedFrom:"产品经理",impact:"未验收前，需求不标记为完成。",resumeWhen:"明确验收通过或需要调整"};

export function startKitImplementation(record,{jobId,time=new Date().toISOString()}={}){
  if(record.currentStageId!=="awaiting-authorization"||record.executionState!=="ready"||
    record.aiPolicy!=="execution-allowed"||!record.workbenchAuthorization||
    record.workbenchAuthorization.implementationStarted)throw Error("IMPLEMENTATION_NOT_READY");
  const next=structuredClone(record);
  ensureKitLifecycle(next,time);
  next.currentStageId="implementation";next.executionState="in-progress";
  next.workbenchAuthorization.implementationStarted=true;
  next.workbenchImplementation={jobId,status:"running",startedAt:time,endedAt:null,changedFiles:[],checks:[]};
  const first=next.activities.find(activity=>activity.id!=="product-review");
  if(first)first.status="进行中";
  appendKitProgress(next,{id:`implementation-start:${jobId}`,at:time,actor:"产品经理",action:"启动本轮实施",
    result:"执行端按已授权文件范围开始工作。",authorization:false,nextActor:"AI"});
  advanceKitLifecycle(next,"executing",{time,activity:"running",actor:"产品经理",event:"已明确启动本轮授权实施"});
  return next;
}

export function completeKitImplementation(record,{jobId,delivery,changedFiles,postHashes,checks,time=new Date().toISOString()}={}){
  if(record.currentStageId!=="implementation"||record.executionState!=="in-progress"||
    record.workbenchImplementation?.jobId!==jobId||!changedFiles?.includes(delivery)||!checks?.length||
    !Array.isArray(postHashes)||postHashes.length!==changedFiles.length)
    throw Error("IMPLEMENTATION_NOT_RUNNING");
  const next=structuredClone(record),ref=`workbench:kit-implementation/${jobId}`;
  next.currentStageId="awaiting-review";next.executionState="waiting-human";next.waitingReason={...reviewReason};
  next.workbenchImplementation={...next.workbenchImplementation,status:"completed",endedAt:time,
    changedFiles:[...changedFiles],postHashes:[...postHashes],checks:[...checks]};
  delete next.workbenchAdjustmentBaseline;
  next.documents=[...new Set([...next.documents,delivery])];
  for(const activity of next.activities){if(activity.id==="product-review")continue;
    activity.status="已完成";activity.evidence=[delivery,ref];
    activity.result="文件范围与工程化检查已通过；业务结果等待产品经理验收。";
  }
  next.artifacts.push({type:"plan",location:delivery,supports:[next.workbenchScheme.acceptance[0]]});
  for(const file of changedFiles.filter(file=>file.startsWith("prototype/src/")))
    next.artifacts.push({type:"prototype",location:file,supports:[next.workbenchScheme.acceptance[0]]});
  next.artifacts.push({type:"test-report",location:ref,supports:[next.workbenchScheme.acceptance[0]]});
  appendKitProgress(next,{id:`implementation-complete:${jobId}`,at:time,actor:"AI",action:"完成工程化交付",
    result:`修改 ${changedFiles.length} 个文件，完成 ${checks.length} 项检查；等待验收。`,authorization:false,nextActor:"产品经理"});
  advanceKitLifecycle(next,"awaiting-review",{time,actor:"AI",event:"交付与工程检查已完成，等待产品经理验收"});
  return next;
}

export function startKitAdjustment(record,{jobId,requestId,text,time=new Date().toISOString()}={}){
  if(record.currentStageId!=="awaiting-review"||record.executionState!=="waiting-human"||
    record.workbenchImplementation?.status!=="completed"||record.workbenchAcceptance||
    typeof text!=="string"||text.trim().length<2)throw Error("ADJUSTMENT_NOT_READY");
  const next=structuredClone(record),previous=structuredClone(next.workbenchImplementation);
  ensureKitLifecycle(next,time);
  next.workbenchImplementationHistory=[...(next.workbenchImplementationHistory||[]),previous];
  next.workbenchAdjustmentBaseline={activities:structuredClone(next.activities),waitingReason:structuredClone(next.waitingReason)};
  next.currentStageId="implementation";next.executionState="in-progress";next.waitingReason=null;
  next.workbenchImplementation={jobId,status:"running",startedAt:time,endedAt:null,changedFiles:[],checks:[],
    adjustment:{requestId,text:text.trim(),sameAuthorization:true}};
  for(const activity of next.activities)if(activity.id!=="product-review"){
    activity.status="进行中";activity.evidence=[];activity.result=null;
  }
  appendKitProgress(next,{id:`adjustment-start:${jobId}`,at:time,actor:"产品经理",action:"提交调整并继续",
    result:text.trim(),authorization:false,nextActor:"AI"});
  advanceKitLifecycle(next,"executing",{time,activity:"running",actor:"产品经理",event:"同范围调整已确认并继续"});
  return next;
}

export function failKitImplementation(record,{jobId,message,time=new Date().toISOString()}={}){
  if(record.currentStageId!=="implementation"||record.workbenchImplementation?.jobId!==jobId)return record;
  const next=structuredClone(record);next.executionState="waiting-human";
  ensureKitLifecycle(next,time);
  next.waitingReason={code:"validation-failed",question:"实施未能安全完成，需要核查现有结果。",
    requestedFrom:"产品经理",impact:message||"结果未验收，且不会自动重试。",
    resumeWhen:"核查台账、文件备份和执行端回执后明确下一步"};
  next.workbenchImplementation={...next.workbenchImplementation,status:"needs-attention",endedAt:time};
  for(const activity of next.activities)if(activity.status==="进行中")activity.status="被阻塞";
  appendKitProgress(next,{id:`implementation-failed:${jobId}`,at:time,actor:"AI",action:"实施中断",
    result:message||"执行未能安全完成，不能自动重试。",authorization:false,nextActor:"产品经理"});
  advanceKitLifecycle(next,"executing",{time,activity:"blocked",actor:"AI",event:"实施中断，等待人工核查"});
  return next;
}

export function retryKitImplementation(record,{jobId,previousJobId,time=new Date().toISOString()}={}){
  if(record.currentStageId!=="implementation"||record.executionState!=="waiting-human"||
    record.workbenchImplementation?.status!=="needs-attention"||record.workbenchImplementation.jobId!==previousJobId||
    !record.workbenchAuthorization?.implementationStarted)throw Error("IMPLEMENTATION_RETRY_NOT_READY");
  const next=structuredClone(record);ensureKitLifecycle(next,time);
  next.workbenchImplementationHistory=[...(next.workbenchImplementationHistory||[]),structuredClone(next.workbenchImplementation)];
  next.executionState="in-progress";next.waitingReason=null;
  next.workbenchImplementation={jobId,status:"running",startedAt:time,endedAt:null,changedFiles:[],checks:[],
    retryOf:previousJobId};
  for(const activity of next.activities)if(activity.status==="被阻塞")activity.status="进行中";
  appendKitProgress(next,{id:`implementation-retry:${jobId}`,at:time,actor:"产品经理",action:"检查并重试实施",
    result:"已核对授权文件仍为开工前版本，创建新的执行任务；旧失败回执保留。",authorization:false,nextActor:"AI"});
  advanceKitLifecycle(next,"executing",{time,activity:"running",actor:"产品经理",event:"核对未发现部分写入，已明确重试实施"});
  return next;
}

export function rejectKitAdjustmentScope(record,{jobId,requestId,text,reason,time=new Date().toISOString()}={}){
  if(record.currentStageId!=="implementation"||record.workbenchImplementation?.jobId!==jobId||
    !record.workbenchImplementation?.adjustment)return record;
  const next=structuredClone(record),previous=next.workbenchImplementationHistory?.at(-1);
  ensureKitLifecycle(next,time);
  if(!previous)throw Error("PREVIOUS_IMPLEMENTATION_MISSING");
  next.workbenchImplementation=previous;next.workbenchImplementationHistory=next.workbenchImplementationHistory.slice(0,-1);
  next.activities=next.workbenchAdjustmentBaseline.activities;
  delete next.workbenchAdjustmentBaseline;
  next.currentStageId="awaiting-review";next.executionState="waiting-human";
  next.waitingReason={code:"rule-ambiguity",question:"调整意见超出本轮已确认范围，是否重新确认业务方案？",
    requestedFrom:"产品经理",impact:reason||"不能沿用原实施授权。",resumeWhen:"重新确认扩大的业务范围与实施授权"};
  next.workbenchAdjustmentRequests=[...(next.workbenchAdjustmentRequests||[]),{requestId,text,status:"scope-expansion",
    reason,checkedAt:time,implementationJobId:jobId}];
  appendKitProgress(next,{id:`scope-expansion:${requestId}`,at:time,actor:"AI",action:"发现调整超出范围",
    result:reason||"不能沿用原授权继续修改。",authorization:false,nextActor:"产品经理"});
  advanceKitLifecycle(next,"awaiting-review",{time,actor:"AI",event:"调整未执行，恢复上一轮待验收成果"});
  advanceKitLifecycle(next,"awaiting-plan",{time,actor:"AI",event:"调整超出原范围，需重新分析并确认方案"});
  return next;
}
