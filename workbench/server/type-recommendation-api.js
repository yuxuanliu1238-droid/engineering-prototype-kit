import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {atomicJson,readJob} from "./analysis-core.js";

const CLI="/Applications/ChatGPT.app/Contents/Resources/codex";
const requestIdValid=value=>/^[0-9a-f-]{36}$/i.test(value||"");
const publicRecommendation=job=>job?{id:job.id,status:job.status,message:job.message,
  createdAt:job.createdAt,updatedAt:job.updatedAt,endedAt:job.endedAt||null,recommendation:job.recommendation||null}:null;

export function typeRecommendationPlugin(runtimeRoot,{cli=CLI,dispatch=spawn}={}){
  const worker=fileURLToPath(new URL("./type-recommendation-worker.js",import.meta.url));
  return {name:"type-recommendation",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/type-recommendations(?:\/([0-9a-f-]{36}))?$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    const host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(req.method==="GET"&&match[1]){
      try{const job=readJob(path.join(runtimeRoot,"type-recommendations",match[1]));
        return job?reply(200,{job:publicRecommendation(job)}):reply(404,{message:"类型建议任务不存在。"});}
      catch{return reply(503,{message:"类型建议状态暂时无法读取。"});}
    }
    if(req.method!=="POST"||match[1])return reply(405,{message:"不支持此操作。"});
    if(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json")
      return reply(403,{message:"请从新建需求表单明确触发建议。"});
    try{
      let body="";for await(const chunk of req){body+=chunk;if(body.length>10000)return reply(413,{message:"描述过长。"});}
      const input=JSON.parse(body),description=typeof input.description==="string"?input.description.trim():"",
        projectName=typeof input.projectName==="string"?input.projectName.trim():"";
      if(input.confirmRecommendationOnly!==true||!requestIdValid(input.requestId)||
        description.length<2||description.length>5000||projectName.length>100)
        return reply(400,{message:"请填写需求描述并确认只分析类型。"});
      if(!fs.existsSync(cli))return reply(503,{message:"本机 AI 类型建议暂不可用；仍可手动选择需求类型。"});
      const directory=path.join(runtimeRoot,"type-recommendations",input.requestId),existing=readJob(directory);
      if(existing){if(existing.description!==description||existing.projectName!==projectName)return reply(409,{message:"相同请求编号的内容不同，请核查。"});
        return reply(200,{job:publicRecommendation(existing),repeated:true});}
      fs.mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});
      try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if(error.code==="EEXIST")return reply(409,{message:"类型建议任务已存在，请核查，不会重复启动。"});throw error;}
      const time=new Date().toISOString(),job={id:input.requestId,status:"submitted",message:"类型建议已提交，等待 AI 开始。",
        createdAt:time,updatedAt:time,heartbeatAt:time,description,projectName,cli};
      atomicJson(path.join(directory,"run.json"),job);
      const child=dispatch(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});
      child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...job,status:"needs-attention",message:"类型建议未能启动；可手动选择，不会自动重试。"}));child.unref();
      return reply(202,{job:publicRecommendation(job)});
    }catch{return reply(503,{message:"类型建议未能安全提交；草稿仍在页面，可手动选择或刷新核查。"});}
  });}};
}
