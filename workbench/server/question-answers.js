import { ANALYSIS_ID,ENDPOINT,hash,validateResult } from "./analysis-core.js";

export const QUESTIONS_ENDPOINT=`${ENDPOINT}/questions`;
export const ANSWER_SUBMIT_ENDPOINT=`${QUESTIONS_ENDPOINT}/submit`;
export const questionsEndpoint=id=>`/api/analysis/cx-recycle/${id}/questions`;
export const answerSubmitEndpoint=id=>`${questionsEndpoint(id)}/submit`;
const reject=(message,status=409)=>Object.assign(Error(message),{status});
export function questionReview(record) {
  const analysis=record?.workbenchAnalysis;
  if(!record?.id || analysis?.status!=="completed") throw reject("分析尚未完成，暂不能回答问题。");
  const resultHash=hash(validateResult(analysis.result));
  const scopeBasis={analysisId:analysis.id,resultHash,scope:[...analysis.result.scope],excluded:[...analysis.result.excluded],targets:[...(analysis.result.targets||[])]};
  const history=record.workbenchQuestionAnswers || [];
  const questions=analysis.result.questions.map((text,index)=>{
    const id=hash([analysis.id,index,text]);
    const revisions=history.filter(item=>item.analysisId===analysis.id && item.resultHash===resultHash && item.questionId===id);
    return {id,text,answer:revisions.at(-1)?.answer || "",savedAt:revisions.at(-1)?.savedAt || null,revisions:revisions.map(({answer,savedAt})=>({answer,savedAt}))};
  });
  const answersDigest=hash(questions.map(({id,answer,savedAt})=>({id,answer,savedAt})));
  const submission=record.workbenchAnswerSubmissions?.findLast(item=>item.analysisId===analysis.id && item.resultHash===resultHash && item.answersDigest===answersDigest) || null;
  return {version:hash(record),analysisId:analysis.id,resultHash,scopeBasis,questions,answersDigest,submission,answered:questions.filter(item=>item.savedAt).length,
    canAnswer:Boolean(record.currentStageId==="impact-analysis" && record.taskControl?.aiPolicy==="planning-only" && record.taskControl?.executionState==="waiting-human")};
}
export function submitAnswersRecord(record,input,time=new Date().toISOString()) {
  const review=questionReview(record);
  if(input.confirmSubmissionOnly!==true || !/^[a-f0-9-]{36}$/.test(input.requestId || "")) throw reject("请明确提交全部已保存回答。",400);
  if(!review.canAnswer || input.analysisId!==review.analysisId || input.resultHash!==review.resultHash || input.answersDigest!==review.answersDigest) throw reject("回答或范围已变化，请刷新后重新核对。");
  const prior=record.workbenchAnswerSubmissions?.find(item=>item.requestId===input.requestId);
  if(prior) {if(prior.answersDigest!==input.answersDigest)throw reject("重复请求内容不同。");return record;}
  if(input.version!==review.version)throw reject("台账已更新，请刷新后核对再提交。");
  if(!review.questions.length || review.questions.some(item=>!item.savedAt || !item.answer.trim()))throw reject("请先保存每一项回答。",400);
  if(review.submission)return record;
  const next=structuredClone(record);
  next.workbenchAnswerSubmissions=[...(record.workbenchAnswerSubmissions || []),{requestId:input.requestId,analysisId:review.analysisId,resultHash:review.resultHash,answersDigest:review.answersDigest,submittedAt:time,answers:review.questions.map(({id,text,answer,savedAt})=>({id,text,answer,savedAt}))}];
  next.stageResults[next.currentStageId]={...next.stageResults[next.currentStageId],updatedAt:new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"}),recordedAt:time,note:"全部回答已提交，等待 AI 核对业务方案；尚未制作原型。"};
  next.taskControl.waitingReason={...next.taskControl.waitingReason,question:"全部回答已提交，AI 将自动核对业务方案。"};
  next.evidence.push({type:"note",reference:`工作台回答提交 ${input.requestId} · ${time}；回答快照见 workbenchAnswerSubmissions；尚未授权制作原型。`});
  return next;
}
export function answerQuestionRecord(record,input,time=new Date().toISOString()) {
  if(input.confirmAnswerOnly!==true || typeof input.answer!=="string" || !input.answer.trim() || input.answer.length>4000 || !/^[a-f0-9-]{36}$/.test(input.requestId || "")) throw reject("请填写 1–4000 字回答，并明确保存本项回答。",400);
  const review=questionReview(record);
  if(!review.canAnswer || input.analysisId!==review.analysisId || input.resultHash!==review.resultHash) throw reject("范围或分析版本已变化，请重新核对；未保存回答。");
  const question=review.questions.find(item=>item.id===input.questionId);
  if(!question) throw reject("这项问题已不在当前分析中。",400);
  const prior=record.workbenchQuestionAnswers?.find(item=>item.requestId===input.requestId);
  if(prior) {
    if(prior.questionId!==input.questionId || prior.answer!==input.answer || prior.resultHash!==input.resultHash) throw reject("重复请求内容不同，请重新核对。");
    return record;
  }
  if(input.version!==review.version) throw reject("台账已有更新。你的输入未丢失，请刷新问题后核对再保存。");
  const next=structuredClone(record);
  next.workbenchQuestionAnswers=[...(record.workbenchQuestionAnswers || []),{requestId:input.requestId,analysisId:review.analysisId,resultHash:review.resultHash,questionId:question.id,question:question.text,answer:input.answer,savedAt:time,savedBy:"产品经理（本机工作台）"}];
  const updated=questionReview(next);
  const answered=new Set(updated.questions.filter(item=>item.savedAt).map(item=>item.text));
  next.pendingQuestions=next.pendingQuestions.filter(text=>!answered.has(text));
  const remaining=updated.questions.length-updated.answered;
  next.taskControl.waitingReason={code:remaining || next.pendingQuestions.length ? "missing-information" : "review-required",question:remaining ? `请继续回答剩余 ${remaining} 项业务问题。` : next.pendingQuestions.length ? "请继续处理台账中其他未回答问题。" : "回答已记录，等待 AI 核对业务方案。",requestedFrom:"产品经理",impact:"保存回答不会自动确认业务方案，也不会制作原型。",resumeWhen:"AI 核对完成后，由产品经理一次确认业务方案。"};
  next.stageResults[next.currentStageId]={...next.stageResults[next.currentStageId],status:"waiting_user",updatedAt:new Date(time).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"}),recordedAt:time,note:`已记录 ${updated.answered}/${updated.questions.length} 项回答；等待核对，尚未制作原型。`};
  next.evidence.push({type:"note",reference:`工作台回答 ${input.requestId} · ${time} · ${question.text}；回答原文见 workbenchQuestionAnswers，尚未授权制作原型。`});
  return next;
}
