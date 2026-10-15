import fs from "node:fs";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {discoverKitProjects} from "./project-discovery.js";
import {renderRequirements,validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";
import {buildKitAuthorizationPlan,authorizeKitRequirement} from "./kit-authorization-core.js";

const hash=text=>createHash("sha256").update(text).digest("hex"),uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");

export function kitAuthorizationPlugin(workspaceRoot,runtimeRoot){
  return {name:"kit-implementation-authorization",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/authorization$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));},host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(!["GET","POST"].includes(req.method))return reply(405,{message:"不支持此操作。"});
    if(req.method==="POST"&&(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json"))
      return reply(403,{message:"请从本机项目需求卡片明确授权。"});
    let locked=false,lock,registryTemp,summaryTemp;
    try{
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需核查。"});
      const root=fs.realpathSync(workspaceRoot),projectRoot=fs.realpathSync(path.join(root,selected.relativePath));
      if(!projectRoot.startsWith(root+path.sep))return reply(403,{message:"项目路径不在工作区内。"});
      const registryPath=path.join(projectRoot,"docs/requirements/registry.json"),summaryPath=path.join(projectRoot,"docs/requirements/requirements.md");
      for(const file of [registryPath,summaryPath])if(!fs.lstatSync(file).isFile()||!fs.realpathSync(file).startsWith(projectRoot+path.sep))
        return reply(422,{message:"台账或视图文件需核查。"});
      if(req.method==="POST"){
        fs.mkdirSync(runtimeRoot,{recursive:true,mode:0o700});lock=path.join(runtimeRoot,`${selected.id}-registry.lock`);
        try{fs.closeSync(fs.openSync(lock,"wx",0o600));locked=true;}
        catch(error){if(error.code==="EEXIST")return reply(409,{message:"该项目台账正在更新，请稍后核查。"});throw error;}
      }
      const before=fs.readFileSync(registryPath,"utf8"),summaryBefore=fs.readFileSync(summaryPath,"utf8"),registry=JSON.parse(before);
      const index=registry.items.findIndex(item=>item.id===match[2]);
      if(index<0)return reply(404,{message:"需求不在当前项目台账中。"});
      const record=registry.items[index],prior=record.workbenchAuthorization;
      if(req.method==="GET")return reply(200,{plan:prior?null:buildKitAuthorizationPlan(projectRoot,record),
        receipt:prior||null,registrySha256:hash(before)});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>4000)return reply(413,{message:"授权请求过长。"});}
      const input=JSON.parse(body);
      if(input.confirmAuthorizationOnly!==true||!uuid(input.requestId)||typeof input.planHash!=="string"||
        typeof input.registrySha256!=="string")return reply(400,{message:"请核对授权范围并明确只授权本轮。"});
      if(prior?.requestId===input.requestId)return reply(200,{receipt:prior,repeated:true});
      if(prior)return reply(409,{message:"本轮已经授权，请核查回执；不会重复授权。"});
      if(input.registrySha256!==hash(before))return reply(409,{message:"项目台账已变化，请重新核对授权范围。"});
      const plan=buildKitAuthorizationPlan(projectRoot,record);
      if(!plan.canAuthorize||plan.planHash!==input.planHash)
        return reply(409,{message:"允许修改的文件或范围已变化，未授权实施。",reasons:plan.reasons});
      registry.items[index]=authorizeKitRequirement(record,plan,input);
      const errors=validateRegistryData(registry);
      if(errors.length)return reply(422,{message:"授权后的台账未通过校验，未保存。",errors:errors.slice(0,10)});
      const suffix=randomUUID(),nextRegistry=JSON.stringify(registry,null,2)+"\n",nextSummary=renderRequirements(registry);
      registryTemp=`${registryPath}.${suffix}.tmp`;summaryTemp=`${summaryPath}.${suffix}.tmp`;
      fs.writeFileSync(path.join(runtimeRoot,`${selected.id}-${suffix}-authorization-backup.json`),JSON.stringify({registry:before,summary:summaryBefore}),{flag:"wx",mode:0o600});
      fs.writeFileSync(registryTemp,nextRegistry,{flag:"wx"});fs.writeFileSync(summaryTemp,nextSummary,{flag:"wx"});
      if(fs.readFileSync(registryPath,"utf8")!==before||fs.readFileSync(summaryPath,"utf8")!==summaryBefore)
        return reply(409,{message:"台账保存前已变化，未授权。"});
      try{fs.renameSync(registryTemp,registryPath);fs.renameSync(summaryTemp,summaryPath);}
      catch{
        if(fs.readFileSync(registryPath,"utf8")===nextRegistry)fs.writeFileSync(registryPath,before);
        if(fs.readFileSync(summaryPath,"utf8")===nextSummary)fs.writeFileSync(summaryPath,summaryBefore);
        throw Error("PARTIAL_SAVE");
      }
      return reply(201,{receipt:registry.items[index].workbenchAuthorization,
        message:"本轮实施范围已授权；AI 尚未启动，项目交付物尚未修改。"});
    }catch{return reply(503,{message:"授权回执未能安全保存，请刷新台账核查；不会自动重复授权或开工。"});}
    finally{for(const temp of [registryTemp,summaryTemp])if(temp)try{fs.unlinkSync(temp);}catch{}
      if(locked)try{fs.unlinkSync(lock);}catch{}}
  });}};
}
