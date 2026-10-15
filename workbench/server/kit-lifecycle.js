const LABELS={"awaiting-analysis":"待分析","awaiting-plan":"待确认方案","awaiting-authorization":"待授权",
  executing:"执行中","awaiting-review":"待验收",completed:"已完成"};
const NEXT={"awaiting-analysis":["awaiting-plan"],"awaiting-plan":["awaiting-authorization"],
  "awaiting-authorization":["executing"],executing:["awaiting-review"],
  "awaiting-review":["awaiting-plan","executing","completed"],completed:[]};

function inferredState(record){
  if(record.currentStageId==="recorded")return "awaiting-analysis";
  if(record.currentStageId==="awaiting-authorization")return "awaiting-authorization";
  if(record.currentStageId==="implementation")return "executing";
  if(record.currentStageId==="awaiting-review")return "awaiting-review";
  if(record.currentStageId==="completed")return "completed";
  return "awaiting-analysis";
}

export function ensureKitLifecycle(record,time=new Date().toISOString()){
  if(record.workbenchLifecycle)return record;
  const state=inferredState(record);record.workbenchLifecycle={state,activity:record.executionState==="in-progress"?"running":"idle",
    updatedAt:time,history:[{state,activity:"idle",at:record.workbenchRegistration?.registeredAt||time,
      actor:"工作台",event:`兼容既有台账，当前归入${LABELS[state]}`} ]};return record;
}

export function advanceKitLifecycle(record,state,{time=new Date().toISOString(),activity="idle",actor="工作台",event}={}){
  ensureKitLifecycle(record,time);const current=record.workbenchLifecycle.state;
  if(state!==current&&!NEXT[current]?.includes(state))throw Error(`INVALID_KIT_LIFECYCLE:${current}->${state}`);
  record.workbenchLifecycle={...record.workbenchLifecycle,state,activity,updatedAt:time,
    history:[...record.workbenchLifecycle.history,{state,activity,at:time,actor,event:event||LABELS[state]}]};
  return record;
}

export const kitLifecycleLabel=state=>LABELS[state]||state;
