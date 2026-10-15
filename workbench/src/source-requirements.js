import snapshot from "./requirement-details.json" with { type: "json" };

export const sourceSnapshot = snapshot;
export function materializeSourceRequirements(snapshot) { return snapshot.items.map(item => ({...item, key:`${snapshot.projectId}:${item.id}`, projectId:snapshot.projectId, project:"cx回收", source:snapshot.source, readAt:snapshot.readAt, sha256:snapshot.sha256})); }
export const sourceRequirements = materializeSourceRequirements(snapshot);
export const executionLabels = {"waiting-human":"等待确认", completed:"已完成", cancelled:"已取消", locked:"未启动", ready:"已就绪", "in-progress":"进行中（台账）", paused:"已暂停", unknown:"未记录"};
export function findSourceRequirement(key) { return sourceRequirements.find(item => item.key === key); }
export function filterSourceRequirements(items, filters) {
  const query = (filters.query || "").trim().toLowerCase();
  return items.filter(item => (!filters.project || item.projectId === filters.project) && (!filters.stage || item.stageId === filters.stage) && (!filters.status || item.executionState === filters.status) && (!query || `${item.id} ${item.title}`.toLowerCase().includes(query)));
}
export function pendingSourceRequirements(items) { return items.filter(item => item.executionState === "waiting-human" || (item.requirementType&&item.stageId==="waiting-start"&&item.executionState==="locked")); }
