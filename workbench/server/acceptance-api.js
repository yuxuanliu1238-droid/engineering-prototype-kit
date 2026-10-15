import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {atomicJson,hash,publicJob,readJob} from "./analysis-core.js";
import {prepareImplementation,readRecord,writeRecord} from "./implementation-core.js";
import {ACCEPTANCE_ENDPOINT,acceptPrototypeRecord,acceptanceReview,requestAdjustment,startAdjustmentRecord} from "./acceptance-core.js";

const CLI="/Applications/ChatGPT.app/Contents/Resources/codex",worker=fileURLToPath(new URL("./implementation-worker.js",import.meta.url));
export function acceptancePlugin(root,runtime,{cli=CLI,dispatch=spawn}={}){
 const originalDirectory=requirementId=>path.join(runtime,`${requirementId}-implementation`);
 const jobFor=(requirementId,adjustment)=>adjustment?readJob(path.join(runtime,`${requirementId}-adjustment-${adjustment.requestId}`)):null;
 const view=(requirementId,record,originalJob)=>{const review=acceptanceReview(record,originalJob),attempt=jobFor(requirementId,review.adjustment),active=["submitted","running"].includes(review.adjustment?.status);return {...review,job:active?publicJob(attempt):null,attempt:attempt?publicJob(attempt):null,plan:originalJob?.prepared?.plan};};
 async function start(requirementId,record,originalJob,adjustment){
  const directory=path.join(runtime,`${requirementId}-adjustment-${adjustment.requestId}`),existing=readJob(directory);if(existing)return view(requirementId,record,originalJob);
  fs.mkdirSync(runtime,{recursive:true,mode:0o700});try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if(error.code==="EEXIST")throw Object.assign(Error("调整任务已存在，请刷新核查。"),{status:409});throw error;}
  const id=randomUUID(),time=new Date().toISOString(),prepared=prepareImplementation(root,cli,requirementId);
  prepared.ready=true;prepared.blockers=[];prepared.plan={...prepared.plan,title:`${requirementId} · 同范围原型调整`,scope:[adjustment.text],excluded:[...prepared.plan.excluded,"不改变已确认的业务规则"]};prepared.basis=hash([prepared.basis,adjustment]);
  let job={id,requirementId,authorizationId:record.workbenchImplementationAuthorization.id,adjustment,status:"submitted",createdAt:time,updatedAt:time,heartbeatAt:time,message:"调整已确认，等待 AI 继续制作原型。",events:[{time,label:"已确认调整并继续"}],projectRoot:root,runtimeRoot:runtime,cli,prepared,authorization:record.workbenchImplementationAuthorization};atomicJson(path.join(directory,"run.json"),job);
  try{const updated=await writeRecord(root,runtime,current=>startAdjustmentRecord(current,adjustment.requestId,id,time),requirementId);job.prepared.record=updated;job.prepared.version=hash(updated);job.expectedRecordHash=hash(updated);atomicJson(path.join(directory,"run.json"),job);const child=dispatch(process.execPath,[worker,directory],{detached:true,stdio:"ignore",env:process.env});child.on("error",()=>atomicJson(path.join(directory,"run.json"),{...job,status:"needs-attention",message:"调整已确认，但 AI 未开始制作；请核查，不会自动重试。"}));child.unref();return view(requirementId,updated,originalJob);}catch(error){atomicJson(path.join(directory,"run.json"),{...job,status:"needs-attention",message:"调整确认或启动制作未能安全完成，请核查；不会自动重试。"});throw error;}
 }
 return {name:"implementation-acceptance",configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,"http://localhost"),matched=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})\/acceptance$/.exec(url.pathname);if(!matched)return next();const requirementId=matched[1];
  const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));};res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
  const host=req.headers.host||"";if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")return reply(403,{message:"仅允许本机工作台访问。"});if(url.search||!["GET","POST"].includes(req.method))return reply(400,{message:"不支持此操作。"});
  try{let record=readRecord(root,requirementId),originalJob=readJob(originalDirectory(requirementId)),review=acceptanceReview(record,originalJob);if(req.method==="GET")return reply(200,view(requirementId,record,originalJob));if(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json")return reply(403,{message:"请从工作台明确确认原型或提交调整。"});let body="";for await(const chunk of req){body+=chunk;if(body.length>8192)return reply(413,{message:"提交内容过长。"});}const input=JSON.parse(body);if(input.confirmPrototypeAccepted===true){record=await writeRecord(root,runtime,current=>acceptPrototypeRecord(current,originalJob,input),requirementId);return reply(200,view(requirementId,record,originalJob));}if(input.confirmAdjustmentAndContinue!==true)return reply(400,{message:"需要明确确认调整并继续。"});let adjustment=review.adjustment;const newRequest=Boolean(input.requestId&&input.text&&review.ready);if(!adjustment||newRequest){record=await writeRecord(root,runtime,current=>requestAdjustment(current,originalJob,{...input,confirmAdjustmentOnly:true}),requirementId);adjustment=acceptanceReview(record,originalJob).adjustment;}else if(input.adjustmentId!==adjustment.requestId||input.version!==review.version)return reply(409,{message:"调整事项已变化，请刷新核查。"});return reply(202,await start(requirementId,record,originalJob,adjustment));}catch(error){return reply(error.status||503,{message:error.status?error.message:"原型确认或调整记录暂时无法安全处理。"});}
 });}};
}
