import fs from "node:fs";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {discoverKitProjects} from "./project-discovery.js";
import {readJob} from "./analysis-core.js";
import {renderRequirements,validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";
import {confirmKitScheme} from "./kit-scheme-core.js";

const hash=text=>createHash("sha256").update(text).digest("hex");
const uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");

export function kitSchemePlugin(workspaceRoot,runtimeRoot){
  return {name:"kit-scheme-confirmation",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/scheme$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));},host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(req.method!=="POST")return reply(405,{message:"请从需求卡片确认方案。"});
    if(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json")
      return reply(403,{message:"请从本机工作台明确确认。"});
    let locked=false,lock,registryTemp,summaryTemp;
    try{
      let body="";for await(const chunk of req){body+=chunk;if(body.length>8000)return reply(413,{message:"回答内容过长。"});}
      const input=JSON.parse(body);
      if(input.confirmSchemeOnly!==true||!uuid(input.requestId)||!uuid(input.analysisId)||
        typeof input.registrySha256!=="string"||typeof input.adoptAllRecommendations!=="boolean"||
        !Array.isArray(input.answers)||input.answers.some(answer=>typeof answer!=="string"||answer.length>1000))
        return reply(400,{message:"请核对方案、业务回答和确认边界。"});
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需核查。"});
      const root=fs.realpathSync(workspaceRoot),projectRoot=fs.realpathSync(path.join(root,selected.relativePath));
      if(!projectRoot.startsWith(root+path.sep))return reply(403,{message:"项目路径不在工作区内。"});
      const registryPath=path.join(projectRoot,"docs/requirements/registry.json"),summaryPath=path.join(projectRoot,"docs/requirements/requirements.md");
      for(const file of [registryPath,summaryPath])if(!fs.lstatSync(file).isFile()||!fs.realpathSync(file).startsWith(projectRoot+path.sep))
        return reply(422,{message:"项目台账或视图不是安全的普通文件。"});
      fs.mkdirSync(runtimeRoot,{recursive:true,mode:0o700});lock=path.join(runtimeRoot,`${selected.id}-registry.lock`);
      try{fs.closeSync(fs.openSync(lock,"wx",0o600));locked=true;}
      catch(error){if(error.code==="EEXIST")return reply(409,{message:"该项目台账正在更新，请稍后核查。"});throw error;}
      const before=fs.readFileSync(registryPath,"utf8"),summaryBefore=fs.readFileSync(summaryPath,"utf8"),registry=JSON.parse(before);
      const index=registry.items.findIndex(item=>item.id===match[2]);
      if(index<0)return reply(404,{message:"需求不在当前项目台账中。"});
      const prior=registry.items[index].workbenchScheme;
      if(prior?.requestId===input.requestId)return reply(200,{scheme:prior,repeated:true});
      if(prior)return reply(409,{message:"业务方案已确认，请核查回执；不会重复确认。"});
      if(hash(before)!==input.registrySha256)return reply(409,{message:"项目台账已变化，请刷新核查；未保存方案。"});
      const job=readJob(path.join(runtimeRoot,"kit-analysis",selected.id,match[2]));
      if(!job||job.id!==input.analysisId||job.status!=="completed"||job.registrySha256!==hash(before)||!job.result)
        return reply(409,{message:"分析结果或项目台账未能核对；未保存方案，也未授权实施。"});
      try{registry.items[index]=confirmKitScheme(registry.items[index],{...job.result,id:job.id,createdAt:job.createdAt,endedAt:job.endedAt},input);}
      catch{return reply(400,{message:"请逐项回答业务问题，或明确采用全部 AI 建议。"});}
      const errors=validateRegistryData(registry);
      if(errors.length)return reply(422,{message:"确认后的台账未通过校验，未保存。",errors:errors.slice(0,10)});
      const suffix=randomUUID(),nextRegistry=JSON.stringify(registry,null,2)+"\n",nextSummary=renderRequirements(registry);
      registryTemp=`${registryPath}.${suffix}.tmp`;summaryTemp=`${summaryPath}.${suffix}.tmp`;
      fs.writeFileSync(path.join(runtimeRoot,`${selected.id}-${suffix}-scheme-backup.json`),JSON.stringify({registry:before,summary:summaryBefore}),{flag:"wx",mode:0o600});
      fs.writeFileSync(registryTemp,nextRegistry,{flag:"wx"});fs.writeFileSync(summaryTemp,nextSummary,{flag:"wx"});
      if(fs.readFileSync(registryPath,"utf8")!==before||fs.readFileSync(summaryPath,"utf8")!==summaryBefore)
        return reply(409,{message:"项目台账保存前已变化，未保存方案。"});
      try{fs.renameSync(registryTemp,registryPath);fs.renameSync(summaryTemp,summaryPath);}
      catch{
        if(fs.readFileSync(registryPath,"utf8")===nextRegistry)fs.writeFileSync(registryPath,before);
        if(fs.readFileSync(summaryPath,"utf8")===nextSummary)fs.writeFileSync(summaryPath,summaryBefore);
        throw Error("PARTIAL_SAVE");
      }
      return reply(201,{scheme:registry.items[index].workbenchScheme,stage:"awaiting-authorization",
        message:"业务方案已确认；还需单独授权实施，不会自动修改项目。"});
    }catch{return reply(503,{message:"方案确认未能安全保存，请刷新台账核查；不会自动重试或授权实施。"});}
    finally{for(const temp of [registryTemp,summaryTemp])if(temp)try{fs.unlinkSync(temp);}catch{}
      if(locked)try{fs.unlinkSync(lock);}catch{}}
  });}};
}
