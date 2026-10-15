import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {atomicJson,publicJob,readJob,hash} from "./analysis-core.js";
import {IMPLEMENT_ENDPOINT,prepareImplementation,writeRecord,authorizeRecord,readRecord} from "./implementation-core.js";
const CLI="/Applications/ChatGPT.app/Contents/Resources/codex";
export function implementationPlugin(root,runtime,{cli=CLI,dispatch=spawn}={}){
 const worker=fileURLToPath(new URL("./implementation-worker.js",import.meta.url));
 const strategyWorker=fileURLToPath(new URL("./strategy-artifact-worker.js",import.meta.url));
 return {name:"scoped-implementation",configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,"http://localhost"),matched=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})\/implementation$/.exec(url.pathname);if(!matched)return next();
  const requirementId=matched[1],directory=path.join(runtime,`${requirementId}-implementation`);
  const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));};res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
  const host=req.headers.host||"";if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")return reply(403,{message:"仅允许本机工作台访问。"});
  if(url.search||!["GET","POST"].includes(req.method))return reply(400,{message:"不支持此操作。"});
  try{
   let input;if(req.method==="POST"){if(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json")return reply(403,{message:"请从工作台明确授权。"});let body="";for await(const chunk of req){body+=chunk;if(body.length>2048)return reply(413,{message:"请求过大。"});}input=JSON.parse(body);if(input?.acceptScopeAndRisk!==true)return reply(400,{message:"必须明确接受本轮范围、验收与风险。"});}
   const existing=readJob(directory);
   if(existing){const record=readRecord(root,requirementId),active=(record?.workbenchStrategyAdjustments||[]).findLast(item=>item.status==="submitted"),
      latest=record?.workbenchTemplate?.deliveryMode==="strategy-artifact"?
        readJob(path.join(runtime,active?`${requirementId}-strategy-adjust-${active.requestId}`:record?.workbenchStrategyDelivery?.jobDirectory||`${requirementId}-implementation`)):null,
      display=latest||existing;
    return reply(200,{job:publicJob(display),changedFiles:display.changedFiles||[],authorization:display.authorization,ready:false});}
   const p=prepareImplementation(root,cli,requirementId);
   if(req.method==="GET")return reply(200,{plan:p.plan,basis:p.basis,version:p.version,blockers:p.blockers,ready:p.ready,job:null});
   if((p.plan.mode==="strategy-artifact"?input?.confirmStrategyArtifact:input?.confirmPrototypeImplementation)!==true)return reply(400,{message:"请明确授权本轮对应的执行路线。"});
   if(!p.ready||p.basis!==input.basis||p.version!==input.version)return reply(409,{message:"准备条件或文件已有变化，请重新查看授权范围。"});
   fs.mkdirSync(runtime,{recursive:true,mode:0o700});try{fs.mkdirSync(directory,{mode:0o700});}catch(e){if(e.code==="EEXIST")return reply(409,{message:"已有授权记录，请刷新核查，不会重复派发。"});throw e;}
   const id=randomUUID(),time=new Date().toISOString();
   let job={id,requirementId,status:"submitted",createdAt:time,updatedAt:time,heartbeatAt:time,message:"授权保存中，尚未派发。",events:[],projectRoot:root,runtimeRoot:runtime,cli,prepared:p};atomicJson(path.join(directory,"run.json"),job);
   try{
    const updated=await writeRecord(root,runtime,r=>authorizeRecord(r,p,id,time),requirementId);
    job.authorization=updated.workbenchImplementationAuthorization;job.expectedRecordHash=hash(updated);job.events.push({time,label:p.plan.mode==="strategy-artifact"?"已授权整理本轮需求成果":"已授权制作本轮原型"});job.message=p.plan.mode==="strategy-artifact"?"授权已保存，等待 AI 整理需求成果。":"授权已保存，等待 AI 开始制作原型。";atomicJson(path.join(directory,"run.json"),job);
    const child=dispatch(process.execPath,[p.plan.mode==="strategy-artifact"?strategyWorker:worker,directory],{detached:true,stdio:"ignore",env:process.env});child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...job,status:"needs-attention",message:"授权已保存，但 AI 未开始执行；请核查，不会自动重试。"}));child.unref();
    return reply(202,{job:publicJob(job),authorization:job.authorization,ready:false});
   }catch(e){job.status="needs-attention";job.message="授权或派发未能安全完成，请核查保存记录；未自动重试。";atomicJson(path.join(directory,"run.json"),job);throw e;}
  }catch(e){return reply(e.status||503,{message:e.status?e.message:"原型制作记录或材料暂时无法读取，请核查。"});}
 });}};
}
