export const lifecycleStates = ["awaiting-analysis", "awaiting-plan", "awaiting-authorization", "executing", "awaiting-review", "completed"];
export const lifecycleLabels = {
  "awaiting-analysis": "待分析",
  "awaiting-plan": "待确认方案",
  "awaiting-authorization": "待授权",
  executing: "执行中",
  "awaiting-review": "待验收",
  completed: "已完成",
};
const nextStates = {
  "awaiting-analysis": ["awaiting-plan"],
  "awaiting-plan": ["awaiting-authorization"],
  "awaiting-authorization": ["executing"],
  executing: ["awaiting-review"],
  "awaiting-review": ["awaiting-plan", "executing", "completed"],
  completed: [],
};
export function initialLifecycle(time) {
  return {state:"awaiting-analysis",activity:"idle",updatedAt:time,history:[{state:"awaiting-analysis",activity:"idle",at:time,actor:"产品经理",event:"需求已登记；尚未启动分析"}]};
}
export function transitionLifecycle(record,state,{time=new Date().toISOString(),activity="idle",actor="工作台",event=""}={}) {
  if(!record.workbenchLifecycle)return record;
  const current=record.workbenchLifecycle.state;
  if(state!==current&&!nextStates[current]?.includes(state))throw Error(`INVALID_LIFECYCLE_TRANSITION:${current}->${state}`);
  const next=structuredClone(record);
  next.workbenchLifecycle={...next.workbenchLifecycle,state,activity,updatedAt:time,history:[...next.workbenchLifecycle.history,{state,activity,at:time,actor,event}]};
  return next;
}
export function validLifecycle(value) {
  return value&&lifecycleStates.includes(value.state)&&["idle","submitted","running","blocked"].includes(value.activity)&&Array.isArray(value.history)&&value.history.length>0&&value.history.at(-1).state===value.state;
}
