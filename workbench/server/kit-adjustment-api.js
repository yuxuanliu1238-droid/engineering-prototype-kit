import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {discoverKitProjects} from "./project-discovery.js";
import {atomicJson} from "./analysis-core.js";
import {registryHash} from "./kit-registry-write.js";
import {reviewSource} from "./kit-review-api.js";
import {validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";
import {inspectKitJob} from "./kit-job-health.js";

const CLI="/Applications/ChatGPT.app/Contents/Resources/codex",uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");
const publicJob=job=>job?{id:job.id,status:job.status,message:job.message,startedAt:job.startedAt||null,
  endedAt:job.endedAt||null,result:job.result||null,changedFiles:job.changedFiles||[]}:null;

export function kitAdjustmentPlugin(workspaceRoot,runtimeRoot,{cli=CLI,dispatch=spawn}={}){
  const worker=fileURLToPath(new URL("./kit-implementation-worker.js",import.meta.url));
  return {name:"kit-same-scope-adjustment",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/adjustment$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));},host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(!["GET","POST"].includes(req.method))return reply(405,{message:"不支持此操作。"});
    if(req.method==="POST"&&(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json"))
      return reply(403,{message:"请从交付验收卡片明确提交调整。"});
    try{
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需核查。"});
      const root=fs.realpathSync(workspaceRoot),projectRoot=fs.realpathSync(path.join(root,selected.relativePath));
      if(!projectRoot.startsWith(root+path.sep))return reply(403,{message:"项目路径不在工作区内。"});
      const raw=fs.readFileSync(path.join(projectRoot,"docs/requirements/registry.json"),"utf8"),registry=JSON.parse(raw);
      if(validateRegistryData(registry).length)return reply(422,{message:"项目台账校验未通过。"});
      const record=registry.items.find(item=>item.id===match[2]);
      if(!record)return reply(404,{message:"需求不在项目台账中。"});
      const pointerPath=path.join(runtimeRoot,"kit-adjustment",selected.id,record.id,"latest.json"),pointer=fs.existsSync(pointerPath)?JSON.parse(fs.readFileSync(pointerPath,"utf8")):null;
      const existing=pointer?inspectKitJob(path.join(runtimeRoot,"kit-adjustment",selected.id,record.id,pointer.id)):null;
      if(req.method==="GET")return reply(200,{job:publicJob(existing)});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>10000)return reply(413,{message:"调整意见过长。"});}
      const input=JSON.parse(body),text=typeof input.text==="string"?input.text.trim():"";
      if(input.confirmAdjustmentAndContinue!==true||input.confirmSameScope!==true||!uuid(input.requestId)||
        text.length<2||text.length>3000||typeof input.reviewDigest!=="string")
        return reply(400,{message:"请填写调整意见，并确认仅在原业务目标和授权范围内继续。"});
      if(existing){if(existing.id===input.requestId)return reply(200,{job:publicJob(existing),repeated:true});
        if(["submitted","running"].includes(existing.status))return reply(409,{message:"上一条调整仍在执行，不能重复提交。"});}
      if(record.currentStageId!=="awaiting-review"||record.executionState!=="waiting-human"||
        record.workbenchAcceptance||record.workbenchImplementation?.status!=="completed")
        return reply(409,{message:"当前交付不处于待验收状态，不能提交调整。"});
      const source=reviewSource(projectRoot,registryHash(raw),record);
      if(source.reviewDigest!==input.reviewDigest)return reply(409,{message:"交付物已变化，请重新查看后再提交调整。"});
      if(!fs.existsSync(cli))return reply(503,{message:"本机 AI 执行端暂不可用；不会修改项目。"});
      const files=record.workbenchImplementation.changedFiles.map(relative=>{
        const full=path.join(projectRoot,relative),content=fs.readFileSync(full,"utf8");
        return {path:relative,content,sha256:registryHash(content)};
      });
      const directory=path.join(runtimeRoot,"kit-adjustment",selected.id,record.id,input.requestId);
      fs.mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});
      try{fs.mkdirSync(directory,{mode:0o700});}
      catch(error){if(error.code==="EEXIST")return reply(409,{message:"调整任务已存在，请核查；不会重复提交。"});throw error;}
      const time=new Date().toISOString(),job={id:input.requestId,projectId:selected.id,projectRoot,
        requirementId:record.id,status:"submitted",message:"调整已提交，等待 AI 核对是否仍在原范围。",
        createdAt:time,updatedAt:time,heartbeatAt:time,sourceRegistrySha256:registryHash(raw),record,files,
        changedFiles:[],cli,runtimeRoot,adjustment:{requestId:input.requestId,text,confirmSameScope:true,reviewDigest:source.reviewDigest}};
      atomicJson(path.join(directory,"run.json"),job);atomicJson(pointerPath,{id:input.requestId,createdAt:time});
      const child=dispatch(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});
      child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...job,status:"needs-attention",message:"调整执行端未能启动；不会自动重试。"}));child.unref();
      return reply(202,{job:publicJob(job)});
    }catch{return reply(503,{message:"调整未能安全提交，请核查当前状态；不会自动重复提交。"});}
  });}};
}
