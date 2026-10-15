import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {discoverKitProjects} from "./project-discovery.js";
import {registryHash,updateKitRegistry} from "./kit-registry-write.js";
import {validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";
import {acceptKitRequirement} from "./kit-acceptance-core.js";
import {readCurrentImplementationJob} from "./kit-job-paths.js";

const uuid=value=>/^[0-9a-f-]{36}$/i.test(value||"");
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function reviewSource(projectRoot,registrySha256,record){
  const root=fs.realpathSync(projectRoot),allowed=new Set([
    ...record.workbenchAuthorization.existingFiles.map(item=>item.path),...record.workbenchAuthorization.createFiles]);
  const changed=record.workbenchImplementation.changedFiles;
  if(!Array.isArray(changed)||!changed.length||changed.some(file=>!allowed.has(file)))throw Error("OUT_OF_SCOPE_REVIEW");
  const files=changed.map(relative=>{
    const target=path.join(root,relative),real=fs.realpathSync(target),stat=fs.lstatSync(target);
    if(!real.startsWith(root+path.sep)||!stat.isFile()||stat.size>160000)throw Error("UNSAFE_REVIEW_FILE");
    const content=fs.readFileSync(real,"utf8");return {path:relative,sha256:registryHash(content),content};
  });
  const expected=new Map((record.workbenchImplementation.postHashes||[]).map(item=>[item.path,item.sha256]));
  if(files.some(item=>expected.get(item.path)!==item.sha256))throw Error("DELIVERY_CHANGED_AFTER_CHECK");
  const delivery=record.workbenchAuthorization.deliveryFile,document=files.find(item=>item.path===delivery);
  if(!document)throw Error("DELIVERY_MISSING");
  return {files:files.map(({content,...item})=>item),deliveryMarkdown:document.content,
    reviewDigest:digest({registrySha256,files:files.map(item=>[item.path,item.sha256])})};
}

export function kitReviewPlugin(workspaceRoot,runtimeRoot){
  return {name:"kit-delivery-review",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/review$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));},host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search)return reply(400,{message:"不支持查询参数。"});
    if(!["GET","POST"].includes(req.method))return reply(405,{message:"不支持此操作。"});
    if(req.method==="POST"&&(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json"))
      return reply(403,{message:"请从需求验收卡片明确确认。"});
    try{
      const selected=discoverKitProjects(workspaceRoot).find(project=>project.id===match[1]&&project.valid);
      if(!selected)return reply(404,{message:"项目未连接或台账需核查。"});
      const root=fs.realpathSync(workspaceRoot),projectRoot=fs.realpathSync(path.join(root,selected.relativePath));
      if(!projectRoot.startsWith(root+path.sep))return reply(403,{message:"项目路径不在工作区内。"});
      const registryPath=path.join(projectRoot,"docs/requirements/registry.json"),raw=fs.readFileSync(registryPath,"utf8"),registry=JSON.parse(raw);
      if(validateRegistryData(registry).length)return reply(422,{message:"项目台账校验未通过。"});
      const record=registry.items.find(item=>item.id===match[2]);
      if(!record)return reply(404,{message:"需求不在台账中。"});
      const receipt=record.workbenchAcceptance;
      if(receipt&&req.method==="GET"){
        const job=readCurrentImplementationJob(runtimeRoot,selected.id,record);let review=null;
        try{const source=reviewSource(projectRoot,registryHash(raw),record);review={...source,summary:job?.result?.summary||"",
          acceptance:record.workbenchScheme.acceptance,checks:record.workbenchImplementation.checks,previewUrl:job?.previewUrl||null};}catch{}
        return reply(200,{receipt,review});
      }
      if(receipt&&req.method==="POST"){
        let repeatedBody="";for await(const chunk of req){repeatedBody+=chunk;if(repeatedBody.length>3000)return reply(413,{message:"验收请求过长。"});}
        try{const repeated=JSON.parse(repeatedBody);if(repeated.requestId===receipt.requestId)
          return reply(200,{receipt,repeated:true});}catch{}
        return reply(409,{message:"本轮已验收完成，请核查回执；不会重复完成。"});
      }
      if(record.workbenchAdjustmentRequests?.at(-1)?.status==="scope-expansion")
        return reply(409,{message:"最近的调整已超出原业务目标或授权范围。请先重新确认方案与实施授权，不能验收旧成果。"});
      const job=readCurrentImplementationJob(runtimeRoot,selected.id,record);
      if(job?.status!=="completed"||job.id!==record.workbenchImplementation?.jobId||
        record.currentStageId!=="awaiting-review")return reply(409,{message:"本轮尚未形成可验收的交付结果。"});
      let source;try{source=reviewSource(projectRoot,registryHash(raw),record);}
      catch{return reply(409,{message:"交付文件在工程检查后发生变化，请先核查并重新检查；不能沿用旧结论验收。"});}
      const review={...source,summary:job.result?.summary||"",acceptance:record.workbenchScheme.acceptance,
        checks:record.workbenchImplementation.checks,previewUrl:job.previewUrl||null};
      if(req.method==="GET")return reply(200,{review,receipt:null});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>3000)return reply(413,{message:"验收请求过长。"});}
      const input=JSON.parse(body);
      if(input.confirmAcceptanceOnly!==true||!uuid(input.requestId)||input.outcome!=="approved"||
        typeof input.previewAcknowledged!=="boolean"||input.reviewDigest!==source.reviewDigest)
        return reply(409,{message:"请重新查看最新交付物与检查结果；未完成验收。"});
      if(record.impactTags.includes("frontend-page")&&!input.previewAcknowledged)
        return reply(400,{message:"请先预览原型，再确认验收。"});
      const updated=updateKitRegistry(projectRoot,runtimeRoot,selected.id,registryHash(raw),next=>{
        const index=next.items.findIndex(item=>item.id===record.id);
        if(index<0)throw Error("RECORD_MISSING");next.items[index]=acceptKitRequirement(next.items[index],input);return next;});
      return reply(201,{receipt:updated.registry.items.find(item=>item.id===record.id).workbenchAcceptance,
        message:"本轮工程化需求已验收完成，不代表生产系统上线。"});
    }catch{return reply(503,{message:"验收未能安全完成，请刷新项目台账核查；不会自动重复提交。"});}
  });}};
}
