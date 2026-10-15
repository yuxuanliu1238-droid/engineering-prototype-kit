export function completeStrategyArtifactRecord(record,{jobId,jobDirectory=null,adjustmentId=null,changedFiles,checks=[],time=new Date().toISOString()}){
  if(record.workbenchTemplate?.deliveryMode!=="strategy-artifact"||
    record.workbenchImplementationAuthorization?.status!=="authorized")throw Error("STRATEGY_AUTHORIZATION_MISSING");
  const next=structuredClone(record),date=new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"});
  next.workbenchImplementationAuthorization.status="awaiting-review";
  if(adjustmentId){const adjustment=(next.workbenchStrategyAdjustments||[]).find(item=>item.requestId===adjustmentId);
    if(!adjustment||adjustment.status!=="submitted")throw Error("STRATEGY_ADJUSTMENT_MISSING");
    adjustment.status="awaiting-review";adjustment.completedAt=time;}
  next.currentStageId="user-review";
  next.taskControl.executionState="waiting-human";
  next.taskControl.waitingReason={code:"review-required",question:"请查看本轮需求成果并验收。",requestedFrom:"产品经理",impact:"本轮只生成已授权的本地需求成果，未进行生产开发。",resumeWhen:"产品经理验收，或提出同范围调整。"};
  for(const id of ["impact-analysis","rule-confirmation"]){
    next.stageResults[id]={...next.stageResults[id],status:"completed",updatedAt:date,recordedAt:time};
  }
  for(const id of ["decision-record","contract-update","prototype-update","page-docs-update"]){
    next.stageResults[id]={status:"skipped",updatedAt:date,recordedAt:time,note:"本类型及影响标签未触发此原型活动。"};
  }
  next.stageResults["consistency-check"]={status:"completed",updatedAt:date,recordedAt:time,note:checks.join("；")||"精确文件范围和成果结构已核对。"};
  next.stageResults["user-review"]={status:"waiting_user",updatedAt:date,recordedAt:time,note:"需求成果已写入，等待产品经理验收。"};
  next.artifacts=[...(next.artifacts||[]),...changedFiles.map(file=>({type:"review-report",location:file,supports:["consistency-check"],createdAt:date}))];
  next.workbenchStrategyDelivery={jobId,jobDirectory,requirementType:next.requirementType,changedFiles:[...changedFiles],checks:[...checks],preparedAt:time,status:"awaiting-review"};
  next.evidence.push({type:"note",reference:`需求成果执行 ${jobId} · ${time}；本轮更新 ${changedFiles.length} 份已授权文档，待产品经理验收。`});
  return next;
}
