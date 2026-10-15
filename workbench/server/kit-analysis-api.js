import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {discoverKitProjects} from "./project-discovery.js";
import {atomicJson,readJob} from "./analysis-core.js";
import {REQUIREMENT_TYPES,IMPACT_TAGS,validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";
import {inspectKitJob} from "./kit-job-health.js";

const CLI="/Applications/ChatGPT.app/Contents/Resources/codex";
const hash=text=>createHash("sha256").update(text).digest("hex");
const uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");
const publicJob=job=>job?{id:job.id,status:job.status,message:job.message,createdAt:job.createdAt||null,startedAt:job.startedAt||null,
  endedAt:job.endedAt||null,result:job.result||null,materials:job.materials?.map(({text,...item})=>item)||[]}:null;

function analysisHistory(runtimeRoot,projectId,requirementId){
  const directory=path.join(runtimeRoot,"kit-analysis-history",projectId,requirementId);
  if(!fs.existsSync(directory))return [];
  return fs.readdirSync(directory).filter(name=>uuid(name)).slice(-20).map(name=>readJob(path.join(directory,name)))
    .filter(Boolean).map(job=>({id:job.id,status:job.status,message:job.message,
      createdAt:job.createdAt||null,endedAt:job.endedAt||null}));
}

export function kitAnalysisMaterials(projectRoot,record){
  const root=fs.realpathSync(projectRoot),files=[],description=record.originalRequest||"";
  const candidates=["project.config.json","project-status.json","docs/requirements/requirements.md"];
  const chunks=description.match(/[\p{Script=Han}]{2,}/gu)||[];
  const words=[...new Set(chunks.flatMap(chunk=>Array.from({length:Math.max(0,chunk.length-1)},(_,index)=>chunk.slice(index,index+2))))].slice(0,100);
  const docsRoot=path.join(root,"docs");
  if(fs.existsSync(docsRoot)){
    const visit=(directory,depth)=>{if(depth>3||files.length>=12)return;
      for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
        if(entry.name.startsWith(".")||entry.name==="node_modules")continue;
        const target=path.join(directory,entry.name);
        if(entry.isDirectory())visit(target,depth+1);
        else if(entry.isFile()&&entry.name.endsWith(".md")&&files.length<12){
          const real=fs.realpathSync(target),stat=fs.statSync(real);
          if(!real.startsWith(root+path.sep)||stat.size>160000)continue;
          const content=fs.readFileSync(real,"utf8");
          if(words.some(word=>content.includes(word)))files.push(path.relative(root,target));
        }
      }
    };visit(docsRoot,0);
  }
  if(record.impactTags?.includes("frontend-page")){
    const prototypeRoot=path.join(root,"prototype/src");
    if(fs.existsSync(prototypeRoot)){
      const visit=(directory,depth)=>{if(depth>5||files.length>=24)return;
        for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
          if(entry.name.startsWith("."))continue;const target=path.join(directory,entry.name);
          if(entry.isDirectory())visit(target,depth+1);
          else if(entry.isFile()&&/\.(jsx?|tsx?|css)$/.test(entry.name)&&files.length<24){
            const real=fs.realpathSync(target),stat=fs.statSync(real);
            if(!real.startsWith(root+path.sep)||stat.size>160000)continue;
            const content=fs.readFileSync(real,"utf8");
            if(words.some(word=>content.includes(word)))files.push(path.relative(root,target));
          }
        }
      };visit(prototypeRoot,0);
    }
  }
  const materials=[{file:`docs/requirements/registry.json#${record.id}`,text:JSON.stringify(record)}];
  for(const relative of [...new Set([...candidates,...files])].slice(0,27)){
    const full=path.join(root,relative);
    if(!fs.existsSync(full)||!fs.lstatSync(full).isFile())continue;
    const real=fs.realpathSync(full),stat=fs.statSync(real);
    if(!real.startsWith(root+path.sep)||stat.size>160000)continue;
    const text=fs.readFileSync(real,"utf8");materials.push({file:relative,sha256:hash(text),text:text.slice(0,30000),excerpt:text.length>30000});
  }
  return materials;
}

export function kitAnalysisPlugin(workspaceRoot,runtimeRoot,{cli=CLI,dispatch=spawn}={}){
  const worker=fileURLToPath(new URL("./kit-analysis-worker.js",import.meta.url));
  return {name:"kit-analysis",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/analysis$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));},host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(!["GET","POST"].includes(req.method))return reply(405,{message:"不支持此操作。"});
    try{
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需核查。"});
      const projectRoot=fs.realpathSync(path.join(fs.realpathSync(workspaceRoot),selected.relativePath));
      const registryPath=path.join(projectRoot,"docs/requirements/registry.json");
      if(!fs.lstatSync(registryPath).isFile()||!fs.realpathSync(registryPath).startsWith(projectRoot+path.sep))
        return reply(422,{message:"项目台账不是安全的普通文件。"});
      const raw=fs.readFileSync(registryPath,"utf8"),registry=JSON.parse(raw);
      if(validateRegistryData(registry).length)return reply(422,{message:"项目台账校验未通过。"});
      const record=registry.items.find(item=>item.id===match[2]);
      if(!record)return reply(404,{message:"需求不在当前项目台账中。"});
      const directory=path.join(runtimeRoot,"kit-analysis",selected.id,record.id),existing=inspectKitJob(directory);
      if(req.method==="GET")return reply(200,{job:publicJob(existing),history:analysisHistory(runtimeRoot,selected.id,record.id),
        registrySha256:hash(raw),stale:!!existing&&existing.registrySha256!==hash(raw)});
      if(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json")
        return reply(403,{message:"请从项目需求卡片明确启动分析。"});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>3000)return reply(413,{message:"请求过长。"});}
      const input=JSON.parse(body);
      if(input.confirmAnalysisOnly!==true||!uuid(input.requestId)||input.registrySha256!==hash(raw))
        return reply(409,{message:"请刷新项目台账并重新核对；不会自动启动。"});
      if(existing?.id===input.requestId)return reply(200,{job:publicJob(existing),repeated:true});
      if(existing&&existing.status!=="needs-attention")
        return reply(409,{message:"已有分析任务，请先核查结果；不会重复启动。"});
      if(record.currentStageId!=="recorded"||record.executionState!=="locked")
        return reply(409,{message:"当前需求不处于待分析状态。"});
      if(!REQUIREMENT_TYPES[record.requirementType]||record.impactTags?.some(tag=>!IMPACT_TAGS[tag]))
        return reply(422,{message:"需求类型或影响范围需核查。"});
      if(!fs.existsSync(cli))return reply(503,{message:"本机 AI 分析暂不可用；项目未被修改。"});
      const materials=kitAnalysisMaterials(projectRoot,record),time=new Date().toISOString();
      if(existing){
        if(!uuid(existing.id))return reply(422,{message:"失败分析任务编号需核查，不能覆盖旧记录。"});
        const archive=path.join(runtimeRoot,"kit-analysis-history",selected.id,record.id,existing.id);
        if(fs.existsSync(archive))return reply(409,{message:"失败任务归档已存在，请先核查，未重复启动。"});
        fs.mkdirSync(path.dirname(archive),{recursive:true,mode:0o700});fs.renameSync(directory,archive);
      }
      fs.mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});
      try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if(error.code==="EEXIST")return reply(409,{message:"分析任务已存在，请先核查，不会重复启动。"});throw error;}
      const job={id:input.requestId,projectId:selected.id,requirementId:record.id,status:"submitted",message:"AI 分析已提交，等待启动。",
        createdAt:time,updatedAt:time,heartbeatAt:time,registrySha256:hash(raw),record,materials,cli};
      atomicJson(path.join(directory,"run.json"),job);
      const child=dispatch(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});
      child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...job,status:"needs-attention",message:"分析未能启动；不会自动重试。"}));child.unref();
      return reply(202,{job:publicJob(job)});
    }catch{return reply(503,{message:"分析状态暂时无法安全处理；项目未被修改。"});}
  });}};
}
