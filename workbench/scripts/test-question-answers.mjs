import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {questionReview,answerQuestionRecord,submitAnswersRecord,QUESTIONS_ENDPOINT,ANSWER_SUBMIT_ENDPOINT} from "../server/question-answers.js";
import {scopePlugin} from "../server/scope-confirmation.js";
import {makeWorkflowRecord} from "./fixtures/workflow-record.mjs";
const root=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const raw=fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8");
const registry=JSON.parse(raw),source=registry.requirements.find(x=>x.id==="CR-029"),record=makeWorkflowRecord(source,{answers:false});
registry.requirements[registry.requirements.findIndex(x=>x.id==="CR-029")]=record;
function input(item=record,index=0,answer="测试回答") {const review=questionReview(item);return {version:review.version,analysisId:review.analysisId,resultHash:review.resultHash,questionId:review.questions[index].id,answer,requestId:randomUUID(),confirmAnswerOnly:true};}
function submission(item){const {version,analysisId,resultHash,answersDigest}=questionReview(item);return {version,analysisId,resultHash,answersDigest,requestId:randomUUID(),confirmSubmissionOnly:true};}
test("explicit complete submission is idempotent, versioned, and never grants implementation",()=>{
  assert.throws(()=>submitAnswersRecord(record,submission(record)));
  let next=structuredClone(record);
  for(let index=0;index<questionReview(record).questions.length;index++)next=answerQuestionRecord(next,input(next,index));
  for(const patch of [{version:"stale"},{answersDigest:"stale"},{confirmSubmissionOnly:false}])assert.throws(()=>submitAnswersRecord(next,{...submission(next),...patch}));
  const body=submission(next),saved=submitAnswersRecord(next,body);
  assert.equal(submitAnswersRecord(saved,body),saved);
  assert.equal(questionReview(saved).submission.answers.length,6);
  for(const key of ["aiPolicy","executionState","readinessChecklist","executionScope"])assert.deepEqual(saved.taskControl[key],next.taskControl[key]);
  const edited=answerQuestionRecord(saved,input(saved,0,"新回答"));
  assert.equal(questionReview(edited).submission,null);assert.equal(edited.workbenchAnswerSubmissions.length,1);
});
test("partial answer records verbatim and does not grant permissions",()=>{
  const next=answerQuestionRecord(record,input(record,0," 原文\n含换行 "));
  assert.equal(questionReview(next).answered,1);assert.equal(next.workbenchQuestionAnswers[0].answer," 原文\n含换行 ");
  assert.equal(next.pendingQuestions.length,record.pendingQuestions.length-1);
  for(const key of ["aiPolicy","executionState","readinessChecklist","executionScope"])assert.deepEqual(next.taskControl[key],record.taskControl[key]);
  assert.equal(next.currentStageId,record.currentStageId);assert.equal(next.confirmedAt,null);
});
test("retry is idempotent; editing retains prior answer and rejects conflicting repeated request",()=>{
  const request=input();const first=answerQuestionRecord(record,request);
  assert.equal(answerQuestionRecord(first,request),first);
  assert.throws(()=>answerQuestionRecord(first,{...request,answer:"different"}));
  const edited=answerQuestionRecord(first,input(first,0,"修改后的测试回答"));
  assert.equal(questionReview(edited).questions[0].revisions.length,2);assert.equal(questionReview(edited).answered,1);
});
test("blank, oversized, stale and wrong questions are rejected; draft scope needs no extra confirmation",()=>{
  for(const patch of [{answer:"  "},{answer:"a".repeat(4001)},{version:"stale"},{questionId:"wrong"},{analysisId:"wrong"},{confirmAnswerOnly:false}])assert.throws(()=>answerQuestionRecord(record,{...input(),...patch}));
  const unconfirmed=structuredClone(record);delete unconfirmed.workbenchScopeConfirmation;assert.doesNotThrow(()=>answerQuestionRecord(unconfirmed,input(unconfirmed)));
});
test("all answers wait for consistency review and preserve unrelated pending questions",async()=>{
  let next=structuredClone(record);next.pendingQuestions.push("其他人工问题");
  for(let index=0;index<questionReview(record).questions.length;index++)next=answerQuestionRecord(next,input(next,index));
  assert.deepEqual(next.pendingQuestions,["其他人工问题"]);assert.equal(next.taskControl.aiPolicy,"planning-only");assert.equal(next.taskControl.executionState,"waiting-human");
  const {validateTaskControl}=await import(path.join(root,"prototype/src/workflow/workflow-engine.js"));
  assert.deepEqual(validateTaskControl(next.taskControl,next.artifacts),[]);
});
test("HTTP isolated save and reload, same-origin protections and other records preserved",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"question-answer-test-")),project=path.join(dir,"project"),runtime=path.join(dir,"runtime");
  for(const file of ["docs/requirements/registry.json","docs/requirements/page-document-map.json","docs/需求池.md"]){fs.mkdirSync(path.dirname(path.join(project,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(project,file));}
  fs.writeFileSync(path.join(project,"docs/requirements/registry.json"),JSON.stringify(registry));
  fs.mkdirSync(path.join(project,"prototype/scripts"),{recursive:true});fs.symlinkSync(path.join(root,"prototype/scripts/workflow-data.mjs"),path.join(project,"prototype/scripts/workflow-data.mjs"));
  let handler;function mount(){scopePlugin(project,runtime).configureServer({middlewares:{use(fn){handler=fn;}}});}mount();
  async function request(method,body,origin="http://127.0.0.1:5174",url=QUESTIONS_ENDPOINT) {let data;const req={url,method,headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};const res={setHeader(){},end(text){data=JSON.parse(text);}};await handler(req,res,()=>assert.fail());return {code:res.statusCode,data};}
  const body=input();assert.equal((await request("POST",body,"https://foreign.example")).code,403);
  const saved=await request("POST",body);assert.equal(saved.code,200,JSON.stringify(saved.data));
  mount();assert.equal((await request("GET")).data.review.answered,1);assert.equal((await request("POST",body)).data.review.answered,1);
  const next=JSON.parse(fs.readFileSync(path.join(project,"docs/requirements/registry.json"),"utf8"));
  assert.deepEqual(next.requirements.filter(x=>x.id!==record.id),registry.requirements.filter(x=>x.id!==record.id));
  let current=next.requirements.find(x=>x.id===record.id);
  for(let index=1;index<questionReview(current).questions.length;index++) {assert.equal((await request("POST",input(current,index))).code,200);current=JSON.parse(fs.readFileSync(path.join(project,"docs/requirements/registry.json"),"utf8")).requirements.find(x=>x.id===record.id);}
  const submitBody=submission(current);
  assert.equal((await request("POST",submitBody,"https://foreign.example",ANSWER_SUBMIT_ENDPOINT)).code,403);
  assert.equal((await request("POST",submitBody,"http://127.0.0.1:5174",ANSWER_SUBMIT_ENDPOINT)).code,200);
  mount();assert((await request("GET")).data.review.submission);
  assert.equal(fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8"),raw);
});
