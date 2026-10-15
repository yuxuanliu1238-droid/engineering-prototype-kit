import path from "node:path";
import fs from "node:fs";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {readJob,atomicJson,publicJob,hash} from "./analysis-core.js";
import {readRecord,readSafe,writeRecord} from "./implementation-core.js";
import {strategyAcceptanceReview,acceptStrategyArtifactRecord} from "./strategy-acceptance-core.js";
import {prepareStrategyAdjustment,startSameScopeStrategyAdjustment} from "./strategy-adjustment-core.js";

const CLI="/Applications/ChatGPT.app/Contents/Resources/codex";
export function strategyAcceptancePlugin(root,runtime,{cli=CLI,dispatch=spawn}={}){
  const worker=fileURLToPath(new URL("./strategy-artifact-worker.js",import.meta.url));
  return {name:"strategy-acceptance",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})\/strategy-acceptance(?:\/(adjust))?$/.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    const host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search||!["GET","POST"].includes(req.method))return reply(400,{message:"不支持此操作。"});
    try{
      const id=match[1],record=readRecord(root,id),active=(record?.workbenchStrategyAdjustments||[]).findLast(item=>item.status==="submitted"),
        activeDirectory=active?`${id}-strategy-adjust-${active.requestId}`:null,
        job=readJob(path.join(runtime,activeDirectory||record?.workbenchStrategyDelivery?.jobDirectory||`${id}-implementation`));
      if(!record||record.workbenchTemplate?.deliveryMode!=="strategy-artifact")return reply(404,{message:"没有此类型需求成果。"});
      const review=strategyAcceptanceReview(record,job);
      if(req.method==="GET"){
        const files=(review.delivery?.changedFiles||[]).map(file=>({path:file,content:readSafe(root,file)}));
        const adjustment=review.ready?prepareStrategyAdjustment(root,record,cli):null;
        return reply(200,{...review,job:job?{status:job.status,message:job.message,result:job.result}:null,files,
          adjustment:adjustment?{ready:true,basis:adjustment.basis,version:adjustment.version,targets:adjustment.plan.targets}:null});
      }
      if(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json")
        return reply(403,{message:"请从工作台明确验收。"});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>2048)return reply(413,{message:"请求过大。"});}
      const input=JSON.parse(body);
      if(!/^[a-f0-9-]{36}$/.test(input.requestId||""))return reply(400,{message:"验收请求无效。"});
      if(match[2]==="adjust"){
        if(input.confirmSameScope!==true||typeof input.text!=="string"||!input.text.trim())
          return reply(400,{message:"请填写意见并确认调整仍在原授权范围内。超出范围须重新确认业务方案。"});
        const prior=(record.workbenchStrategyAdjustments||[]).find(item=>item.requestId===input.requestId);
        if(prior){if(prior.text!==input.text.trim())return reply(409,{message:"重复请求内容不同，请核查。"});
          return reply(200,{job:publicJob(readJob(path.join(runtime,`${id}-strategy-adjust-${prior.requestId}`))),repeated:true});}
        const prepared=prepareStrategyAdjustment(root,record,cli);
        if(input.version!==prepared.version||input.basis!==prepared.basis)
          return reply(409,{message:"成果或授权文件已变化，请重新核对后提交。"});
        const directory=path.join(runtime,`${id}-strategy-adjust-${input.requestId}`);
        fs.mkdirSync(runtime,{recursive:true,mode:0o700});
        try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if(error.code==="EEXIST")return reply(409,{message:"调整任务已存在，请核查，不会重复派发。"});throw error;}
        const jobId=randomUUID(),time=new Date().toISOString();
        let adjustmentJob={id:jobId,requirementId:id,status:"submitted",createdAt:time,updatedAt:time,heartbeatAt:time,
          message:"调整已保存，等待 AI 继续整理。",events:[],projectRoot:root,runtimeRoot:runtime,cli,
          prepared,authorization:record.workbenchImplementationAuthorization,
          authorizationId:record.workbenchImplementationAuthorization.id,adjustment:{requestId:input.requestId,text:input.text.trim()}};
        atomicJson(path.join(directory,"run.json"),adjustmentJob);
        const updated=await writeRecord(root,runtime,current=>startSameScopeStrategyAdjustment(current,
          {requestId:input.requestId,text:input.text,jobId,basis:input.basis,version:input.version},prepared,time),id);
        adjustmentJob.expectedRecordHash=hash(updated);atomicJson(path.join(directory,"run.json"),adjustmentJob);
        const child=dispatch(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});
        child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...adjustmentJob,status:"needs-attention",message:"调整已保存，但 AI 未开始；请核查，不会自动重试。"}));child.unref();
        return reply(202,{job:publicJob(adjustmentJob),ready:false});
      }
      const updated=await writeRecord(root,runtime,current=>acceptStrategyArtifactRecord(current,job,input),id);
      return reply(200,{accepted:true,receipt:updated.workbenchStrategyAcceptance,requestId:input.requestId});
    }catch(error){return reply(error.status||503,{message:error.status?error.message:"需求成果暂时无法读取或保存，请核查；不会自动重复验收。"});}
  });}};
}
