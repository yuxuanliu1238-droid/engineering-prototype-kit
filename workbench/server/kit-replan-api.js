import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {discoverKitProjects} from "./project-discovery.js";
import {atomicJson} from "./analysis-core.js";
import {kitAnalysisMaterials} from "./kit-analysis-api.js";
import {registryHash,updateKitRegistry} from "./kit-registry-write.js";
import {confirmKitScheme} from "./kit-scheme-core.js";
import {REQUIREMENT_TYPES,IMPACT_TAGS,validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";
import {inspectKitJob} from "./kit-job-health.js";

const CLI="/Applications/ChatGPT.app/Contents/Resources/codex",uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");
const publicJob=job=>job?{id:job.id,status:job.status,message:job.message,createdAt:job.createdAt,
  endedAt:job.endedAt||null,result:job.result||null,replan:job.replan||null}:null;

export function kitReplanPlugin(workspaceRoot,runtimeRoot,{cli=CLI,dispatch=spawn}={}){
  const worker=fileURLToPath(new URL("./kit-analysis-worker.js",import.meta.url));
  return {name:"kit-scope-replan",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/replan(\/confirm)?$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));},host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(!["GET","POST"].includes(req.method)||match[3]&&req.method!=="POST")return reply(405,{message:"不支持此操作。"});
    if(req.method==="POST"&&(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json"))
      return reply(403,{message:"请从项目需求卡片明确操作。"});
    try{
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需核查。"});
      const root=fs.realpathSync(workspaceRoot),projectRoot=fs.realpathSync(path.join(root,selected.relativePath));
      if(!projectRoot.startsWith(root+path.sep))return reply(403,{message:"项目路径不在工作区内。"});
      const raw=fs.readFileSync(path.join(projectRoot,"docs/requirements/registry.json"),"utf8"),registry=JSON.parse(raw);
      if(validateRegistryData(registry).length)return reply(422,{message:"项目台账校验未通过。"});
      const record=registry.items.find(item=>item.id===match[2]);
      if(!record)return reply(404,{message:"需求不在台账中。"});
      const directoryRoot=path.join(runtimeRoot,"kit-replan",selected.id,record.id),pointerPath=path.join(directoryRoot,"latest.json"),
        pointer=fs.existsSync(pointerPath)?JSON.parse(fs.readFileSync(pointerPath,"utf8")):null,
        previousJob=pointer?inspectKitJob(path.join(directoryRoot,pointer.id)):null,
        job=previousJob?.sourceRegistrySha256===registryHash(raw)?previousJob:null;
      if(req.method==="GET")return reply(200,{job:publicJob(job),registrySha256:registryHash(raw)});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>10000)return reply(413,{message:"请求内容过长。"});}
      const input=JSON.parse(body);
      if(match[3]){
        if(input.confirmReplannedSchemeOnly!==true||!uuid(input.requestId)||!uuid(input.analysisId)||
          typeof input.registrySha256!=="string"||typeof input.adoptAllRecommendations!=="boolean"||
          !Array.isArray(input.answers)||input.answers.some(answer=>typeof answer!=="string"||answer.length>1000))
          return reply(400,{message:"请核对新业务方案与问题回答。"});
        if(record.workbenchScheme?.requestId===input.requestId)return reply(200,{scheme:record.workbenchScheme,repeated:true});
        if(record.workbenchAdjustmentRequests?.at(-1)?.status!=="scope-expansion"||
          record.currentStageId!=="awaiting-review"||!job||job.id!==input.analysisId||job.status!=="completed"||
          job.sourceRegistrySha256!==registryHash(raw))return reply(409,{message:"新分析或台账已变化，请重新核对；不会继承旧授权。"});
        const updated=updateKitRegistry(projectRoot,runtimeRoot,selected.id,registryHash(raw),next=>{
          const index=next.items.findIndex(item=>item.id===record.id);if(index<0)throw Error("RECORD_MISSING");
          next.items[index]=confirmKitScheme(next.items[index],{...job.result,id:job.id,createdAt:job.createdAt,endedAt:job.endedAt},{...input,replan:true,
            requirementType:job.replan.requirementType,impactTags:job.replan.impactTags});return next;});
        return reply(201,{scheme:updated.registry.items.find(item=>item.id===record.id).workbenchScheme,
          message:"扩大后的业务方案已确认；原实施授权已归档，仍需单独授权本轮修改。"});
      }
      const expandedDescription=typeof input.expandedDescription==="string"?input.expandedDescription.trim():"";
      if(input.confirmReadOnlyAnalysis!==true||!uuid(input.requestId)||input.registrySha256!==registryHash(raw)||
        expandedDescription.length<2||expandedDescription.length>3000||!REQUIREMENT_TYPES[input.requirementType]||
        !Array.isArray(input.impactTags)||input.impactTags.some(tag=>!IMPACT_TAGS[tag])||
        new Set(input.impactTags).size!==input.impactTags.length||
        (input.requirementType==="existing-page-adjustment"&&!input.impactTags.includes("frontend-page")))
        return reply(400,{message:"请填写扩大后的业务目标、主类型与影响范围。"});
      if(record.workbenchAdjustmentRequests?.at(-1)?.status!=="scope-expansion"||record.currentStageId!=="awaiting-review")
        return reply(409,{message:"当前需求没有待重新确认的扩大范围调整。"});
      if(!job&&previousJob&&["submitted","running"].includes(previousJob.status))
        return reply(409,{message:"先前重新分析仍在运行；请核查，不能并行重复启动。"});
      if(job){if(job.id===input.requestId)return reply(200,{job:publicJob(job),repeated:true});
        if(["submitted","running","completed"].includes(job.status))return reply(409,{message:"已有重新分析任务，请先核查结果，不会重复启动。"});}
      if(!fs.existsSync(cli))return reply(503,{message:"本机 AI 分析暂不可用；项目未修改。"});
      const analysisRecord={...record,requirementType:input.requirementType,impactTags:input.impactTags,
        originalRequest:`${record.originalRequest}\n\n本轮扩大范围调整：${expandedDescription}`};
      const materials=kitAnalysisMaterials(projectRoot,analysisRecord),time=new Date().toISOString(),directory=path.join(directoryRoot,input.requestId);
      fs.mkdirSync(directoryRoot,{recursive:true,mode:0o700});
      try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if(error.code==="EEXIST")return reply(409,{message:"分析任务已存在，请核查。"});throw error;}
      const nextJob={id:input.requestId,projectId:selected.id,requirementId:record.id,status:"submitted",
        message:"扩大范围分析已提交，等待 AI 启动。",createdAt:time,updatedAt:time,heartbeatAt:time,
        sourceRegistrySha256:registryHash(raw),record:analysisRecord,materials,cli,
        replan:{expandedDescription,requirementType:input.requirementType,impactTags:input.impactTags}};
      atomicJson(path.join(directory,"run.json"),nextJob);atomicJson(pointerPath,{id:input.requestId,createdAt:time});
      const child=dispatch(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});
      child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...nextJob,status:"needs-attention",message:"重新分析未能启动；不会自动重试。"}));child.unref();
      return reply(202,{job:publicJob(nextJob)});
    }catch{return reply(503,{message:"重新分析或方案确认未能安全处理，请核查；不会自动重复提交。"});}
  });}};
}
