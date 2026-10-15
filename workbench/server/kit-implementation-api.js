import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {discoverKitProjects} from "./project-discovery.js";
import {atomicJson} from "./analysis-core.js";
import {registryHash,updateKitRegistry} from "./kit-registry-write.js";
import {validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";
import {implementationDirectory} from "./kit-job-paths.js";
import {inspectKitJob} from "./kit-job-health.js";
import {failKitImplementation} from "./kit-implementation-core.js";

const CLI="/Applications/ChatGPT.app/Contents/Resources/codex",uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");
const publicJob=job=>job?{id:job.id,status:job.status,message:job.message,startedAt:job.startedAt||null,
  endedAt:job.endedAt||null,result:job.result||null,changedFiles:job.changedFiles||[]}:null;

export function kitImplementationPlugin(workspaceRoot,runtimeRoot,{cli=CLI,dispatch=spawn}={}){
  const worker=fileURLToPath(new URL("./kit-implementation-worker.js",import.meta.url));
  return {name:"kit-implementation",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/implementation(\/retry)?$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));},host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(!["GET","POST"].includes(req.method))return reply(405,{message:"不支持此操作。"});
    if(req.method==="POST"&&(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json"))
      return reply(403,{message:"请从项目需求卡片明确启动。"});
    try{
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需核查。"});
      const root=fs.realpathSync(workspaceRoot),projectRoot=fs.realpathSync(path.join(root,selected.relativePath));
      if(!projectRoot.startsWith(root+path.sep))return reply(403,{message:"项目路径不在工作区内。"});
      const registryPath=path.join(projectRoot,"docs/requirements/registry.json");
      if(!fs.lstatSync(registryPath).isFile()||!fs.realpathSync(registryPath).startsWith(projectRoot+path.sep))
        return reply(422,{message:"项目台账不是安全的普通文件。"});
      let raw=fs.readFileSync(registryPath,"utf8"),registry=JSON.parse(raw);
      if(validateRegistryData(registry).length)return reply(422,{message:"项目台账校验未通过。"});
      let record=registry.items.find(item=>item.id===match[2]);
      if(!record)return reply(404,{message:"需求不在项目台账中。"});
      const directory=implementationDirectory(runtimeRoot,selected.id,record),existing=inspectKitJob(directory);
      if(existing?.status==="needs-attention"&&record.currentStageId==="implementation"&&
        record.executionState==="in-progress"&&record.workbenchImplementation?.jobId===existing.id&&
        existing.sourceRegistrySha256===registryHash(raw)){
        const updated=updateKitRegistry(projectRoot,runtimeRoot,selected.id,registryHash(raw),next=>{
          const index=next.items.findIndex(item=>item.id===record.id);next.items[index]=failKitImplementation(next.items[index],{
            jobId:existing.id,message:existing.message});return next;});
        raw=fs.readFileSync(registryPath,"utf8");registry=updated.registry;record=registry.items.find(item=>item.id===match[2]);
      }
      if(req.method==="GET")return reply(200,{job:publicJob(existing),registrySha256:registryHash(raw)});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>3000)return reply(413,{message:"启动请求过长。"});}
      const input=JSON.parse(body);
      const retry=Boolean(match[3]);
      if((retry?input.confirmRetryAfterInspection!==true:input.confirmImplementationStart!==true)||!uuid(input.requestId)||
        input.registrySha256!==registryHash(raw)||input.authorizationPlanHash!==record.workbenchAuthorization?.planHash)
        return reply(409,{message:"请重新核对台账和本轮授权；不会自动派发。"});
      if(existing?.id===input.requestId)return reply(200,{job:publicJob(existing),repeated:true});
      let retryAfterStart=false;
      if(retry){
        retryAfterStart=record.currentStageId==="implementation"&&record.executionState==="waiting-human"&&
          record.workbenchImplementation?.status==="needs-attention"&&record.workbenchImplementation.jobId===existing?.id;
        const retryBeforeStart=record.currentStageId==="awaiting-authorization"&&record.executionState==="ready"&&
          record.workbenchAuthorization&&!record.workbenchAuthorization.implementationStarted;
        if(existing?.status!=="needs-attention"||!retryAfterStart&&!retryBeforeStart)
          return reply(409,{message:"当前没有经过核查、可安全重试的失败任务。"});
      }else{
        if(existing)return reply(200,{job:publicJob(existing),repeated:true});
        if(record.currentStageId!=="awaiting-authorization"||record.executionState!=="ready"||
          !record.workbenchAuthorization||record.workbenchAuthorization.implementationStarted)
          return reply(409,{message:"本轮尚未处于已授权、待启动状态。"});
      }
      const expectedDelivery=`docs/review/${record.id}-${record.requirementType}-delivery.md`;
      if(record.workbenchAuthorization.deliveryFile!==expectedDelivery||
        ![JSON.stringify([expectedDelivery]),JSON.stringify([])].includes(JSON.stringify(record.workbenchAuthorization.createFiles))||
        (!record.workbenchAuthorization.createFiles.length&&
          !record.workbenchAuthorization.existingFiles.some(file=>file.path===expectedDelivery)))
        return reply(422,{message:"授权新建文件范围需核查；未派发实施。"});
      if(!fs.existsSync(cli))return reply(503,{message:"本机 AI 执行端暂不可用；不会修改项目。"});
      const files=[];
      for(const allowed of record.workbenchAuthorization.existingFiles){
        const full=path.join(projectRoot,allowed.path),real=fs.realpathSync(full),stat=fs.lstatSync(full);
        if(!real.startsWith(projectRoot+path.sep)||!stat.isFile()||stat.size>30000)
          return reply(422,{message:`授权文件不能安全读取：${allowed.path}`});
        const content=fs.readFileSync(real,"utf8");
        if(registryHash(content)!==allowed.sha256)return reply(409,{message:`授权文件已经变化：${allowed.path}；未派发实施。`});
        files.push({path:allowed.path,content,sha256:allowed.sha256});
      }
      for(const relative of record.workbenchAuthorization.createFiles)
        if(fs.existsSync(path.join(projectRoot,relative)))return reply(409,{message:"交付文件已经存在；请先核查，未派发实施。"});
      if(retry){
        const archive=path.join(runtimeRoot,"kit-implementation-history",selected.id,record.id,existing.id);
        if(fs.existsSync(archive))return reply(409,{message:"失败任务已归档，请刷新核查，未重复启动。"});
        fs.mkdirSync(path.dirname(archive),{recursive:true,mode:0o700});fs.renameSync(directory,archive);
      }
      fs.mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});
      try{fs.mkdirSync(directory,{mode:0o700});}
      catch(error){if(error.code==="EEXIST")return reply(409,{message:"实施任务已存在，请核查，不会重复开工。"});throw error;}
      const time=new Date().toISOString(),job={id:input.requestId,projectId:selected.id,projectRoot,
        requirementId:record.id,status:"submitted",message:"实施请求已接收，等待执行端启动。",
        createdAt:time,updatedAt:time,heartbeatAt:time,sourceRegistrySha256:registryHash(raw),
        record,files,changedFiles:[],cli,runtimeRoot,...(retry?{retry:{previousJobId:existing.id,afterStart:retryAfterStart}}:{})};
      atomicJson(path.join(directory,"run.json"),job);
      const child=dispatch(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});
      child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...job,status:"needs-attention",message:"执行端未能启动；不会自动重复派发。"}));child.unref();
      return reply(202,{job:publicJob(job)});
    }catch{return reply(503,{message:"启动实施未能安全处理，请核查当前状态；不会自动重复派发。"});}
  });}};
}
