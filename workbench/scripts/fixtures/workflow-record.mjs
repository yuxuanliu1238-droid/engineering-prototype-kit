import {hash,validateResult} from "../../server/analysis-core.js";

export function makeWorkflowRecord(source,{answers=true,business=false}={}){
  const record=structuredClone(source);
  const result=validateResult(record.workbenchAnalysis.result);
  record.currentStageId="impact-analysis";
  record.confirmedAt=null;
  const stageOrder=["registered","waiting-start","impact-analysis","rule-confirmation","decision-record","contract-update","prototype-update","page-docs-update","consistency-check","user-review","synced"];
  record.stageResults={...record.stageResults,"impact-analysis":{...record.stageResults["impact-analysis"],status:"waiting_user",note:"AI 已完成分析，等待产品经理确认业务方案。"}};
  for(const id of stageOrder.slice(stageOrder.indexOf("impact-analysis")+1))record.stageResults[id]={status:"not_started",updatedAt:null,note:"尚未开始"};
  record.taskControl={...record.taskControl,aiPolicy:"planning-only",executionState:"waiting-human",waitingReason:{code:"review-required",question:"请确认本轮业务方案。",requestedFrom:"产品经理",impact:"尚未授权制作原型。",resumeWhen:"业务方案确认后单独授权制作原型。"}};
  record.workbenchScopeConfirmation={...(record.workbenchScopeConfirmation||{}),analysisId:record.workbenchAnalysis.id,resultHash:hash(result),scope:[...result.scope],excluded:[...result.excluded],implementationAuthorized:false};
  for(const key of ["workbenchImplementationAuthorization","workbenchImplementationAdjustments","workbenchPrototypeAcceptance","workbenchPrototypeDelivery"])delete record[key];
  if(!answers){delete record.workbenchQuestionAnswers;delete record.workbenchAnswerSubmissions;record.pendingQuestions=[...result.questions];}
  if(!business)delete record.workbenchBusinessDecisions;
  return record;
}
