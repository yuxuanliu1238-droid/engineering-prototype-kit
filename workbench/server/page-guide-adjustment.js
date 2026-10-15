import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";

export const PAGE_GUIDE_ADJUSTMENT_ENDPOINT="/api/analysis/cx-recycle/CR-029/page-guide-adjustment";
const CLI="/Applications/ChatGPT.app/Contents/Resources/codex";
const publicJob=job=>job&&({id:job.id,status:job.status,message:job.message,summary:job.summary||null,createdAt:job.createdAt,updatedAt:job.updatedAt});
const atomic=(file,data)=>{const temp=`${file}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(data,null,2)+"\n",{flag:"wx",mode:0o600});fs.renameSync(temp,file);};

export function pageGuideAdjustmentPlugin(projectRoot,runtimeRoot){
 const worker=path.resolve(runtimeRoot,"../server/page-guide-adjustment-worker.js");
 const register=server=>{server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,"http://localhost"),matched=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})\/page-guide-adjustment$/.exec(url.pathname);if(!matched)return next();const requirementId=matched[1],directory=path.join(runtimeRoot,`${requirementId}-page-guide-adjustment`),runFile=path.join(directory,"run.json");
  res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
  const reply=(code,data)=>{res.statusCode=code;res.end(JSON.stringify(data));},host=req.headers.host||"";
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||req.headers["sec-fetch-site"]==="cross-site"||(req.headers.origin&&req.headers.origin!==`http://${host}`))return reply(403,{message:"仅允许本机工作台访问。"});
  if(url.search||!["GET","POST"].includes(req.method))return reply(405,{message:"不支持此操作。"});
  try{
   const job=fs.existsSync(runFile)?JSON.parse(fs.readFileSync(runFile,"utf8")):null;
   if(req.method==="GET")return reply(200,{job:publicJob(job),available:fs.existsSync(CLI)});
   if(req.headers.origin!==`http://${host}`||!String(req.headers["content-type"]||"").startsWith("application/json"))return reply(403,{message:"请从本机工作台提交调整意见。"});
   let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>12000)return reply(413,{message:"调整意见过长。"});}
   const input=JSON.parse(raw||"{}"),text=String(input.text||"").trim();
   if(input.confirmAiPageGuideEdit!==true||!/^[a-f0-9-]{36}$/.test(input.requestId||"")||text.length<2)return reply(400,{message:"请填写调整意见并确认交给 AI 修改。"});
   if(job&&["submitted","running"].includes(job.status))return reply(409,{message:"AI 正在修改，请等待本轮完成。"});
   if(!fs.existsSync(CLI))return reply(503,{message:"本机 AI 暂不可用，尚未开始修改。"});
   fs.mkdirSync(directory,{recursive:true,mode:0o700});
   const now=new Date().toISOString(),pending={id:input.requestId,requirementId,status:"submitted",message:"已提交，等待 AI 开始修改页面说明。",text,version:input.version,createdAt:now,updatedAt:now,projectRoot,cli:CLI};
   atomic(runFile,pending);const child=spawn(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});child.unref();
   return reply(202,{job:publicJob(pending)});
  }catch{return reply(503,{message:"调整任务无法安全启动，请稍后重试。"});}
 });};
 return {name:"page-guide-adjustment",configureServer:register};
}
