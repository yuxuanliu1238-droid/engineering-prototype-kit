import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {transitionLifecycle} from "../src/requirement-lifecycle.js";

export const ANALYSIS_ID = "CR-029";
export const ENDPOINT = "/api/analysis/cx-recycle/CR-029";
export const analysisEndpoint = id => `/api/analysis/cx-recycle/${id}`;
export const validRequirementId = id => /^CR-\d{3,}$/.test(id || "");
export const hash = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
export const terminal = job => ["completed", "failed", "needs-attention"].includes(job.status);
export function atomicJson(filename, value) {
  const temp = `${filename}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, filename);
}
export function readJob(directory) {
  try { return JSON.parse(fs.readFileSync(path.join(directory, "run.json"), "utf8")); }
  catch (error) { if (error.code === "ENOENT" && !fs.existsSync(directory)) return null; throw error; }
}
export function publicJob(job, now = Date.now()) {
  if (!job) return null;
  const stale = !terminal(job) && now - Date.parse(job.heartbeatAt || job.createdAt) > 90000;
  return { id:job.id, status:stale ? "needs-attention" : job.status, createdAt:job.createdAt,
    startedAt:job.startedAt, endedAt:job.endedAt, updatedAt:job.updatedAt,
    message:stale ? "执行回执已中断，请核查现有任务；不会自动重复启动。" : job.message,
    result:job.result, events:job.events || [], registrySaved:job.registrySaved || false };
}
export function canStart(record) {
  return validRequirementId(record?.id) && record.currentStageId === "waiting-start"
    && record.taskControl?.executionState === "locked" && record.taskControl?.aiPolicy === "unassessed"
    && record.taskControl?.executionScope?.mode === "record-only" && !record.workbenchAnalysis;
}
export function advanceJob(job, event, time = new Date().toISOString()) {
  if (terminal(job)) return job;
  const next = {...job, updatedAt:time};
  if (event.type === "turn.started" && !job.startedAt) {
    next.status = "running"; next.startedAt = time; next.message = "AI 正在分析已提供的需求材料。";
    next.events = [...job.events, {time, label:"AI 已开始分析需求"}];
  }
  if (event.type === "item.completed" && event.item?.type === "agent_message") next.candidate = event.item.text;
  if (event.type === "turn.completed") next.turnCompleted = true;
  if (event.type === "turn.failed" || event.type === "error") {
    next.status = "failed"; next.endedAt = time; next.message = "分析未能完成，已有记录已保留。请核查后再决定是否重试。";
  }
  return next;
}
export function validateResult(value) {
  if (!value || typeof value.summary !== "string" || !value.summary.trim()) throw Error("INVALID_RESULT");
  for (const key of ["facts", "scope", "excluded", "questions", "acceptance", "evidence"]) {
    if (!Array.isArray(value[key]) || value[key].length > 20 || value[key].some(x => typeof x !== "string" || x.length > 3000)) throw Error("INVALID_RESULT");
  }
  if (value.summary.length > 3000) throw Error("INVALID_RESULT");
  const result=Object.fromEntries(["summary","facts","scope","excluded","questions","acceptance","evidence"].map(key=>[key,value[key]]));
  if(value.targets!==undefined){if(!Array.isArray(value.targets)||value.targets.length>30||value.targets.some(x=>typeof x!=="string"||x.length>300))throw Error("INVALID_RESULT");result.targets=value.targets;}
  return result;
}
export function analysisRecord(record, job) {
  const next = structuredClone(record);
  const time = job.endedAt || job.startedAt;
  const date = new Date(time).toLocaleDateString("sv-SE", {timeZone:"Asia/Shanghai"});
  const finished = terminal(job);
  const artifact=record.workbenchTemplate?.deliveryMode==="strategy-artifact";
  next.currentStageId = "impact-analysis";
  next.stageResults["waiting-start"] = {status:"completed",updatedAt:date,note:`产品经理在工作台启动需求分析 ${job.id}；尚未授权执行。`};
  next.stageResults["impact-analysis"] = {status:finished ? (job.status === "completed" ? "waiting_user" : "blocked") : "active",updatedAt:date,recordedAt:time,note:job.message};
  next.taskControl.aiPolicy = "planning-only";
  next.taskControl.executionState = finished ? "waiting-human" : "in-progress";
  next.taskControl.readinessChecklist = next.taskControl.readinessChecklist.map(check => check.id === "goal-clear" ? {...check,status:"met",evidence:[`registry:${record.id}.notes`,`工作台分析目标：整理范围、排除项、待确认问题及验收建议；${job.id}`]} : check);
  next.taskControl.executionScope = {mode:"planning-only",label:"仅分析，不修改业务代码、契约或决策",allowedArtifactTypes:["plan"],deferredArtifactTypes:record.taskControl.executionScope.deferredArtifactTypes.filter(type=>type!=="plan"),authorizationBasis:[`工作台开始分析确认：${job.createdAt}；任务 ${job.id}`]};
  next.taskControl.waitingReason = finished ? {code:job.status === "completed" ? "review-required" : "validation-failed",question:job.status === "completed" ? "请回答必要的业务问题，并确认本轮业务方案。" : "请核查这次需求分析，是否需要重新开始？",requestedFrom:"产品经理",impact:"确认业务方案前不会修改项目。",resumeWhen:`产品经理确认业务方案后，再单独授权${artifact?"整理需求成果":"制作原型"}。`} : null;
  next.workbenchAnalysis = publicJob(job);
  next.evidence = [...record.evidence, {type:"note",reference:`工作台分析回执 ${job.id} · ${time} · ${job.message}`}];
  return transitionLifecycle(next,finished&&job.status==="completed"?"awaiting-plan":"awaiting-analysis",{time,activity:finished&&job.status!=="completed"?"blocked":finished?"idle":"running",actor:"AI 执行端",event:job.message});
}
