import {hash} from "./analysis-core.js";
import {readSafe} from "./implementation-core.js";
import {transitionLifecycle} from "../src/requirement-lifecycle.js";

const fail=message=>Object.assign(Error(message),{status:409});
export function prepareStrategyAdjustment(root,record,cli){
  const authorization=record.workbenchImplementationAuthorization,delivery=record.workbenchStrategyDelivery;
  if(record.workbenchTemplate?.deliveryMode!=="strategy-artifact"||authorization?.status!=="awaiting-review"||
    delivery?.status!=="awaiting-review"||record.workbenchStrategyAcceptance)throw fail("当前成果不允许再次调整。");
  const plan=authorization.plan;
  if(plan?.mode!=="strategy-artifact"||!Array.isArray(plan.targets)||!plan.targets.length)throw fail("原授权范围无效。");
  const files=plan.targets.map(file=>({path:file,content:readSafe(root,file)}));
  const support=["AGENTS.md","prototype/AGENTS.md","docs/decisions/NEGATIVE_DECISIONS.md"].map(file=>({path:file,content:readSafe(root,file)}));
  return {record,plan,files,support,snapshot:files.map(file=>({path:file.path,hash:hash(file.content)})),
    supportSnapshot:support.map(file=>({path:file.path,hash:hash(file.content)})),version:hash(record),
    basis:hash([authorization.id,delivery.jobId,plan,files.map(file=>[file.path,hash(file.content)])]),cli};
}

export function startSameScopeStrategyAdjustment(record,{requestId,text,jobId,basis,version},prepared,time=new Date().toISOString()){
  if(!/^[a-f0-9-]{36}$/.test(requestId||"")||typeof text!=="string"||!text.trim()||text.length>4000)throw fail("请填写调整意见并确认同范围继续。");
  const prior=(record.workbenchStrategyAdjustments||[]).find(item=>item.requestId===requestId);
  if(prior){if(prior.text!==text.trim())throw fail("重复请求内容不同。");return record;}
  if(version!==prepared.version||basis!==prepared.basis)throw fail("原授权文件或成果已变化，请重新核对。");
  const next=structuredClone(record);
  next.workbenchStrategyAdjustments=[...(next.workbenchStrategyAdjustments||[]),{requestId,text:text.trim(),jobId,status:"submitted",createdAt:time,scope:"same",authorizationId:next.workbenchImplementationAuthorization.id}];
  next.workbenchImplementationAuthorization.status="authorized";
  next.workbenchStrategyDelivery.status="changes-requested";
  const date=new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"});
  next.currentStageId="consistency-check";
  next.stageResults["consistency-check"]={status:"active",updatedAt:date,recordedAt:time,note:"同范围成果调整已确认，正在重新整理与核对。"};
  next.stageResults["user-review"]={status:"not_started",updatedAt:date,recordedAt:time,note:"等待本轮调整完成后重新验收。"};
  next.taskControl.aiPolicy="execution-allowed";next.taskControl.executionState="ready";next.taskControl.waitingReason=null;
  next.evidence.push({type:"note",reference:`同范围需求成果调整 ${requestId} · ${time}；沿用原精确文件授权，不扩展业务范围。`});
  return transitionLifecycle(next,"executing",{time,activity:"submitted",actor:"产品经理",event:"同范围调整已确认并继续"});
}
