import fs from "node:fs";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {discoverKitProjects} from "./project-discovery.js";
import {makeRecordedRequirement,renderRequirements,validateRegistryData,REQUIREMENT_TYPES,IMPACT_TAGS} from "../../scripts/workflow-v3-lib.mjs";

const digest=value=>createHash("sha256").update(value).digest("hex");
const uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");
export function nextKitRequirementId(items){
  const number=items.reduce((max,item)=>Math.max(max,Number(/^CR-(\d+)$/.exec(item.id||"")?.[1]||0)),0);
  return `CR-${String(number+1).padStart(3,"0")}`;
}

export function kitProjectRegistrationPlugin(workspaceRoot,runtimeRoot){
  return {name:"kit-project-registration",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements$/.exec(url.pathname);
    if(!match||req.method!=="POST")return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    const host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||req.headers.origin!==`http://${host}`||
      req.headers["content-type"]!=="application/json"||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"请从本机工作台明确登记。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    let locked=false,lock,registryTemp,summaryTemp;
    try{
      let body="";for await(const chunk of req){body+=chunk;if(body.length>20000)return reply(413,{message:"需求内容过长。"});}
      const input=JSON.parse(body),description=typeof input.description==="string"?input.description.trim():"";
      if(input.confirmRecordOnly!==true||!uuid(input.requestId)||!REQUIREMENT_TYPES[input.requirementType]||
        description.length<2||description.length>5000||!Array.isArray(input.impactTags)||
        input.impactTags.some(tag=>!IMPACT_TAGS[tag])||new Set(input.impactTags).size!==input.impactTags.length)
        return reply(400,{message:"请核对需求类型、影响范围和仅登记边界。"});
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需要核查。"});
      const root=fs.realpathSync(workspaceRoot),projectRoot=fs.realpathSync(path.join(root,selected.relativePath));
      if(!projectRoot.startsWith(root+path.sep))return reply(403,{message:"项目路径不在工作区内。"});
      const registryPath=path.join(projectRoot,"docs/requirements/registry.json"),summaryPath=path.join(projectRoot,"docs/requirements/requirements.md");
      for(const file of [registryPath,summaryPath])if(!fs.lstatSync(file).isFile()||!fs.realpathSync(file).startsWith(projectRoot+path.sep))
        return reply(422,{message:"项目台账或可读视图不是安全的普通文件。"});
      fs.mkdirSync(runtimeRoot,{recursive:true,mode:0o700});lock=path.join(runtimeRoot,`${selected.id}-registry.lock`);
      try{fs.closeSync(fs.openSync(lock,"wx",0o600));locked=true;}
      catch(error){if(error.code==="EEXIST")return reply(409,{message:"该项目正在登记，请稍后核查。"});throw error;}
      const before=fs.readFileSync(registryPath,"utf8"),summaryBefore=fs.readFileSync(summaryPath,"utf8"),registry=JSON.parse(before);
      const prior=registry.items.find(item=>item.workbenchRegistration?.requestId===input.requestId);
      if(prior)return reply(200,{id:prior.id,title:prior.summary,repeated:true,state:"recorded"});
      if(digest(before)!==input.registrySha256)return reply(409,{message:"项目台账已变化，请刷新后重新核对；不会重复登记。"});
      const id=nextKitRequirementId(registry.items),record=makeRecordedRequirement({id,description,
        requirementType:input.requirementType,impactTags:input.impactTags,requestId:input.requestId});
      registry.items.push(record);
      const errors=validateRegistryData(registry);
      if(errors.length)return reply(422,{message:"新需求未通过台账校验。",errors:errors.slice(0,10)});
      const suffix=randomUUID();registryTemp=`${registryPath}.${suffix}.tmp`;summaryTemp=`${summaryPath}.${suffix}.tmp`;
      fs.writeFileSync(path.join(runtimeRoot,`${selected.id}-${suffix}-registration-backup.json`),
        JSON.stringify({registry:before,summary:summaryBefore}),{flag:"wx",mode:0o600});
      fs.writeFileSync(registryTemp,JSON.stringify(registry,null,2)+"\n",{flag:"wx"});
      fs.writeFileSync(summaryTemp,renderRequirements(registry),{flag:"wx"});
      if(fs.readFileSync(registryPath,"utf8")!==before||fs.readFileSync(summaryPath,"utf8")!==summaryBefore)
        return reply(409,{message:"项目台账在保存前已变化，已停止。"});
      try{fs.renameSync(registryTemp,registryPath);fs.renameSync(summaryTemp,summaryPath);}
      catch(error){
        const nextText=JSON.stringify(registry,null,2)+"\n";
        if(fs.readFileSync(registryPath,"utf8")===nextText)fs.writeFileSync(registryPath,before);
        if(fs.readFileSync(summaryPath,"utf8")===renderRequirements(registry))fs.writeFileSync(summaryPath,summaryBefore);
        throw error;
      }
      return reply(201,{id,title:record.summary,state:"recorded",message:"需求已登记，未启动 AI、未确认方案、未授权实施。"});
    }catch{return reply(503,{message:"需求登记未能安全完成，请刷新项目台账核查；不会自动重试。"});}
    finally{
      for(const temp of [registryTemp,summaryTemp])if(temp)try{fs.unlinkSync(temp);}catch{/* already renamed or kept for audit */}
      if(locked)try{fs.unlinkSync(lock);}catch{/* lock remains for manual audit */}
    }
  });}};
}
