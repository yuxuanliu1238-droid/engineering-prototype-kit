import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {ENDPOINT,hash,readJob,publicJob,atomicJson} from "./analysis-core.js";
import {questionReview} from "./question-answers.js";
export const REVIEW_ENDPOINT=`${ENDPOINT}/review`;
export const reviewEndpoint=id=>`/api/analysis/cx-recycle/${id}/review`;
const CLI="/Applications/ChatGPT.app/Contents/Resources/codex";
export function reviewIdentity(record) {
  const answers=questionReview(record);
  return {answers,key:hash([answers.analysisId,answers.resultHash,answers.answersDigest,answers.scopeBasis]),eligible:answers.canAnswer&&Boolean(answers.submission)};
}
export function reviewPlugin(projectRoot,runtimeRoot,{cli=CLI,dispatch=spawn}={}) {
  const worker=fileURLToPath(new URL("./analysis-worker.js",import.meta.url));
  return {name:"answer-review",configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),matched=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})\/review$/.exec(url.pathname);if(!matched)return next();
    const requirementId=matched[1];
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const reply=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
    const host=req.headers.host || "";
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||req.headers["sec-fetch-site"]==="cross-site"||(req.headers.origin&&req.headers.origin!==`http://${host}`))return reply(403,{message:"仅允许本机工作台操作。"});
    if(url.search)return reply(400,{message:"不接受附加参数。"});
    if(!["GET","POST"].includes(req.method))return reply(405,{message:"不支持此操作。"});
    try {
      const raw=fs.readFileSync(path.join(projectRoot,"docs/requirements/registry.json"),"utf8"),registry=JSON.parse(raw);
      if(registry.project.id!=="cx-recycle")throw Error("PROJECT");
      const record=registry.requirements.find(item=>item.id===requirementId),{answers,key,eligible}=reviewIdentity(record);
      const directory=path.join(runtimeRoot,`review-${requirementId}-${key}`),legacyDirectory=path.join(runtimeRoot,`review-${key}`),activeDirectory=requirementId==="CR-029"&&fs.existsSync(legacyDirectory)?legacyDirectory:directory,job=readJob(activeDirectory);
      const stale=Boolean(job && (job.recordHash!==hash(record) || job.materials?.some(item=>item.sha256&&hash(fs.readFileSync(path.join(projectRoot,item.file),"utf8"))!==item.sha256)));
      const view=()=>({job:publicJob(job),stale,version:hash(record),key,canStart:eligible&&!job&&fs.existsSync(cli),available:fs.existsSync(cli)});
      if(req.method==="GET")return reply(200,view());
      if(req.headers.origin!==`http://${host}`||req.headers["content-type"]!=="application/json")return reply(403,{message:"请从工作台明确启动核对。"});
      let body="";for await(const chunk of req){body+=chunk;if(body.length>2048)return reply(413,{message:"请求过大。"});}
      const input=JSON.parse(body);
      if(!input||input.confirmReviewOnly!==true)return reply(400,{message:"需要明确的仅核对确认。"});
      if(input.key!==key||!eligible)return reply(409,{message:"回答或范围已变化，请先保存并提交回答，再刷新工作台。"});
      if(job)return reply(200,view());
      if(input.version!==hash(record))return reply(409,{message:"台账已变化，请刷新后再启动。"});
      if(!fs.existsSync(cli))return reply(503,{message:"本机 AI 处理能力暂不可用，尚未开始核对。"});
      fs.mkdirSync(runtimeRoot,{recursive:true,mode:0o700});
      try{fs.mkdirSync(activeDirectory,{mode:0o700});}catch(e){if(e.code==="EEXIST")return reply(409,{message:"已有核对任务，请刷新核查，不会重复开工。"});throw e;}
      const now=new Date().toISOString();
      const pending={id:randomUUID(),requirementId,kind:"answer-review",status:"submitted",createdAt:now,updatedAt:now,heartbeatAt:now,message:"回答已提交，等待 AI 开始核对。",events:[{time:now,label:"已提交回答并启动 AI 核对"}],sourceHash:hash(raw),recordHash:hash(record),projectRoot,cli,reviewKey:key,submission:answers.submission};
      atomicJson(path.join(activeDirectory,"run.json"),pending);
      const child=dispatch(process.execPath,[worker,activeDirectory],{detached:true,stdio:"ignore",env:process.env});
      child.on("error",()=>atomicJson(path.join(activeDirectory,"run.json"),{...pending,status:"failed",endedAt:new Date().toISOString(),message:"AI 核对未能启动，请核查；不会自动重试。"}));child.unref();
      return reply(202,{...view(),job:publicJob(pending),canStart:false});
    }catch{return reply(503,{message:"核对记录无法安全读取，请刷新核查；不会自动启动或重试。"});}
  });}};
}
