import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { ENDPOINT, hash, atomicJson, validateResult, readJob } from "./analysis-core.js";
import { questionReview,answerQuestionRecord,submitAnswersRecord } from "./question-answers.js";
import {businessReview,saveBusinessDecisions,authorizeImplementation} from "./business-decisions.js";
import {reviewIdentity} from "./answer-review.js";

export const SCOPE_ENDPOINT = `${ENDPOINT}/scope`;
export const scopeEndpoint=id=>`/api/analysis/cx-recycle/${id}/scope`;
function conflict(message) {return Object.assign(Error(message),{status:409});}
export function scopeReview(record) {
  const analysis=record?.workbenchAnalysis;
  if(!record?.id || analysis?.status!=="completed") throw conflict("分析尚未完成，暂不能确认范围。");
  const result=validateResult(analysis.result);
  const resultHash=hash(result);
  const saved=record.workbenchScopeConfirmation;
  const confirmation=saved?.analysisId===analysis.id && saved.resultHash===resultHash ? saved : null;
  return {version:hash(record),analysisId:analysis.id,resultHash,result,confirmation,
    canConfirm:!saved && record.currentStageId==="impact-analysis" && record.taskControl?.executionState==="waiting-human" && record.taskControl?.aiPolicy==="planning-only"};
}
export function confirmScopeRecord(record,input,time=new Date().toISOString()) {
  if(input.confirmScopeOnly!==true) throw Object.assign(Error("请明确确认本轮业务范围；这不等于授权制作原型。"),{status:400});
  const review=scopeReview(record);
  if(input.analysisId!==review.analysisId || input.resultHash!==review.resultHash) throw conflict("分析结果已变化，请重新查看后确认。");
  if(review.confirmation) return record; // Retry returns the same receipt, never creates another decision.
  if(!review.canConfirm || input.version!==review.version) throw conflict("台账已变化，请刷新确认卡片后再操作。");
  const next=structuredClone(record);
  next.workbenchScopeConfirmation={id:randomUUID(),analysisId:review.analysisId,resultHash:review.resultHash,confirmedAt:time,confirmedBy:"产品经理（本机工作台）",scope:review.result.scope,excluded:review.result.excluded,unresolvedQuestions:review.result.questions,implementationAuthorized:false};
  next.pendingQuestions=[...new Set([...next.pendingQuestions,...review.result.questions])];
  next.taskControl.readinessChecklist=next.taskControl.readinessChecklist.map(check=>check.id==="scope-clear" ? {...check,status:"met",evidence:[`registry:${record.id}.workbenchScopeConfirmation；${time}`]} : check);
  next.taskControl.waitingReason={code:next.pendingQuestions.length ? "rule-ambiguity" : "authorization-required",question:next.pendingQuestions.length ? "请逐项确认尚未解决的业务问题。" : "请先确认完整业务方案，再单独授权制作原型。",requestedFrom:"产品经理",impact:"业务范围记录不等于确认完整业务方案，也不等于授权制作原型。",resumeWhen:"业务问题有明确结论并确认业务方案后，再决定是否授权制作原型；不自动继续。"};
  next.stageResults[next.currentStageId]={...next.stageResults[next.currentStageId],status:"waiting_user",updatedAt:new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"}),recordedAt:time,note:"已记录本轮业务范围；待确认问题仍保留，尚未授权制作原型。"};
  next.evidence.push({type:"note",reference:`历史业务范围记录 ${next.workbenchScopeConfirmation.id} · ${time} · 分析 ${review.analysisId}；不代表确认完整业务方案，也不授权制作原型。`});
  return next;
}

export function scopePlugin(projectRoot,runtimeRoot) {
  const registryPath=path.join(projectRoot,"docs/requirements/registry.json");
  const poolPath=path.join(projectRoot,"docs/需求池.md");
  const register=server=>{server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,"http://localhost");
    const matched=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})\/(scope|questions|questions\/submit|decisions|authorization)$/.exec(url.pathname);
    if(!matched) return next();
    const requirementId=matched[1],operation=matched[2];
    const answering=operation!=="scope";
    const business=["decisions","authorization"].includes(operation);
    const reviewedBusiness=record=>{
      const view=businessReview(record),identity=reviewIdentity(record),generic=path.join(runtimeRoot,`review-${record.id}-${identity.key}`),legacy=path.join(runtimeRoot,`review-${identity.key}`),job=readJob(record.id==="CR-029"&&fs.existsSync(legacy)?legacy:generic);
      const reviewCompleted=Boolean(view.receipt||(!identity.answers.questions.length)||(job?.status==="completed"&&job.recordHash===hash(record)));
      const unresolved=job?.status==="completed"&&job.recordHash===hash(record)&&Array.isArray(job.result?.questions)?job.result.questions:[];
      const reviewPassed=reviewCompleted&&!unresolved.length;
      const blockers=!reviewCompleted?["请等待 AI 完成业务方案核对",...view.blockers]:unresolved.length?[`AI 核对发现 ${unresolved.length} 项业务问题，请返回修改相关回答后重新提交`,...view.blockers]:view.blockers;
      return {...view,eligible:view.eligible&&reviewPassed,reviewCompleted,reviewPassed,reviewQuestions:unresolved,blockers};
    };
    const reviewFor=business ? reviewedBusiness : answering ? questionReview : scopeReview;
    const updateRecord=operation==="authorization" ? authorizeImplementation : operation==="decisions" ? saveBusinessDecisions : operation==="questions/submit" ? submitAnswersRecord : answering ? answerQuestionRecord : confirmScopeRecord;
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");
    const reply=(code,data)=>{res.statusCode=code;res.end(JSON.stringify(data));};
    const host=req.headers.host || "";
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || req.headers["sec-fetch-site"]==="cross-site" || (req.headers.origin && req.headers.origin!==`http://${host}`)) return reply(403,{message:"仅允许本机工作台访问。"});
    if(url.search) return reply(400,{message:"不接受附加参数。"});
    if(!["GET","POST"].includes(req.method)) return reply(405,{message:"不支持此操作。"});
    let lock;
    try {
      let input;
      if(req.method==="POST") {
        if(req.headers.origin!==`http://${host}` || req.headers["content-type"]!=="application/json") return reply(403,{message:"请从工作台确认范围。"});
        let body="";for await(const chunk of req) {body+=chunk;if(body.length>(answering ? 12000 : 2048)) return reply(413,{message:"请求过大。"});}
        try {input=JSON.parse(body);} catch {return reply(400,{message:"确认请求格式有误。"});}
        if(!input || typeof input!=="object") return reply(400,{message:"缺少确认内容。"});
        fs.mkdirSync(runtimeRoot,{recursive:true,mode:0o700});
        lock=path.join(runtimeRoot,"scope-confirmation.lock");
        try {fs.closeSync(fs.openSync(lock,"wx",0o600));} catch(error) {lock=null;if(error.code==="EEXIST") return reply(409,{message:"确认正在保存或上次保存需要核查，请稍后刷新确认卡片。"});throw error;}
      }
      const before=fs.readFileSync(registryPath,"utf8");
      const registry=JSON.parse(before);
      if(registry.project.id!=="cx-recycle") throw Error("WRONG_PROJECT");
      const index=registry.requirements.findIndex(item=>item.id===requirementId);
      const record=registry.requirements[index];
      if(index<0)return reply(404,{message:"需求不存在。"});
      if(req.method==="GET") return reply(200,{review:reviewFor(record)});
      if(operation==="decisions"&&!reviewFor(record).eligible)throw conflict("AI 尚未完成业务方案核对，暂不能确认业务方案。");
      const updated=updateRecord(record,input);
      if(updated===record) return reply(200,{review:reviewFor(record)});
      registry.requirements[index]=updated;
      const workflow=await import(/* @vite-ignore */ pathToFileURL(path.join(projectRoot,"prototype/scripts/workflow-data.mjs")).href);
      const pageMap=JSON.parse(fs.readFileSync(path.join(projectRoot,"docs/requirements/page-document-map.json"),"utf8"));
      const validation=await workflow.validateWorkflowData(registry,pageMap);
      if(!validation.valid) throw conflict("台账校验未通过，未保存确认。请核查现有记录。");
      const poolBefore=fs.readFileSync(poolPath,"utf8");
      const operationId=randomUUID();
      atomicJson(path.join(runtimeRoot,`decision-backup-${operationId}.json`),{registry:before,pool:poolBefore});
      const pool=workflow.renderRequirementPool(registry);
      const temp=`${poolPath}.${operationId}.tmp`;
      fs.writeFileSync(temp,pool,{flag:"wx"});
      if(fs.readFileSync(registryPath,"utf8")!==before || fs.readFileSync(poolPath,"utf8")!==poolBefore) throw conflict("发现同时修改，未覆盖台账；请刷新确认卡片后重试。");
      atomicJson(registryPath,registry);
      fs.renameSync(temp,poolPath);
      return reply(200,{review:reviewFor(updated)});
    } catch(error) {return reply(error.status || 503,{message:error.status ? error.message : "保存结果暂无法确认，请刷新确认卡片核查；不要重复授权。"});}
    finally {if(lock) fs.unlinkSync(lock);}
  });};
  return {name:"cx-scope-confirmation",configureServer:register};
}
