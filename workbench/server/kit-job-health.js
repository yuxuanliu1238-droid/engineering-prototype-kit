import {atomicJson,readJob} from "./analysis-core.js";
import path from "node:path";

const RUNNING=new Set(["submitted","running"]);

function processAlive(pid){
  if(!Number.isInteger(pid)||pid<=0)return null;
  try{process.kill(pid,0);return true;}catch(error){return error.code==="ESRCH"?false:true;}
}

export function inspectKitJob(directory,{now=Date.now(),maxHeartbeatAgeMs=90000}={}){
  const job=readJob(directory);
  if(!job||!RUNNING.has(job.status))return job;
  const heartbeat=Date.parse(job.heartbeatAt||job.createdAt);
  if(Number.isFinite(heartbeat)&&now-heartbeat<=maxHeartbeatAgeMs)return job;
  const alive=processAlive(job.workerPid);
  if(alive===true)return {...job,message:"执行端仍存活，但状态回执延迟；不会重复启动。",heartbeatDelayed:true};
  if(alive===null)return {...job,status:"needs-attention",message:"执行回执已中断，旧任务缺少进程信息；请人工核查，不能自动重试。",retryable:false};
  const next={...job,status:"needs-attention",endedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),
    message:"执行端已停止，任务未完成；已保留记录，不会自动重试。"};
  atomicJson(path.join(directory,"run.json"),next);
  return next;
}
