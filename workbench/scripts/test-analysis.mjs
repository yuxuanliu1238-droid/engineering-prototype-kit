import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ANALYSIS_ID, hash, canStart, advanceJob, publicJob, analysisRecord, validateResult, atomicJson, readJob } from "../server/analysis-core.js";
import { cliArgs } from "../server/analysis-worker.js";
import { analysisPlugin } from "../server/analysis-api.js";

const businessRoot=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const realSource=fs.readFileSync(path.join(businessRoot,"docs/requirements/registry.json"),"utf8");
const registry=JSON.parse(realSource);
const record=registry.requirements.find(item=>item.id===ANALYSIS_ID);
// Reset only the isolated fixture: real CR-029 may have advanced since this test was written.
delete record.workbenchAnalysis;delete record.workbenchScopeConfirmation;
for(const key of ["workbenchQuestionAnswers","workbenchAnswerSubmissions","workbenchBusinessDecisions","workbenchImplementationAuthorization","workbenchImplementationAdjustments","workbenchPrototypeAcceptance","workbenchPrototypeDelivery"])delete record[key];
record.currentStageId="waiting-start";
record.confirmedAt=null;
record.stageResults={registered:{status:"completed",updatedAt:"2026-09-10",note:"fixture"},"waiting-start":{status:"waiting_user",updatedAt:"2026-09-10",note:"fixture"}};
record.taskControl.executionState="locked";record.taskControl.aiPolicy="unassessed";record.taskControl.waitingReason=null;
record.taskControl.readinessChecklist=record.taskControl.readinessChecklist.map(x=>({...x,status:"not-assessed",evidence:[]}));
record.taskControl.executionScope={mode:"record-only",label:"仅登记",allowedArtifactTypes:[],deferredArtifactTypes:["plan","decision","contract","prototype","page-guide","test-report","review-report","user-confirmation","commit","release"],authorizationBasis:["fixture"]};
const now=new Date().toISOString();
const pending=()=>({id:"fixture-run",status:"submitted",createdAt:now,updatedAt:now,heartbeatAt:now,events:[],message:"等待接单"});

test("any untouched formal CR may start",()=>{
  assert(canStart(record));
  assert(canStart({...record,id:"CR-030"}));
  for(const item of [{...record,id:"REQ-028"},{...record,currentStageId:"impact-analysis"},{...record,workbenchAnalysis:{}},{...record,taskControl:{...record.taskControl,aiPolicy:"execution-allowed"}}]) assert(!canStart(item));
});
test("thread created is not execution acknowledgment; only turn.started promotes",()=>{
  let job=advanceJob(pending(),{type:"thread.started"});assert.equal(job.status,"submitted");
  job=advanceJob(job,{type:"turn.started"});assert.equal(job.status,"running");assert(job.startedAt);
  assert.equal(advanceJob(job,{type:"turn.started"}).events.length,1);
  job=advanceJob(job,{type:"turn.failed"});assert.equal(job.status,"failed");
  assert.equal(advanceJob(job,{type:"turn.started"}).status,"failed");
});
test("stale receipts require attention and never invent stopped or completed",()=>{
  assert.equal(publicJob(pending(),Date.now()+100000).status,"needs-attention");
  assert.equal(publicJob({...pending(),status:"completed"},Date.now()+100000).status,"completed");
});
test("analysis authorization does not authorize implementation or confirm rules",async()=>{
  const job=advanceJob(pending(),{type:"turn.started"});
  const next=analysisRecord(record,job);
  assert.equal(next.taskControl.aiPolicy,"planning-only");
  assert.deepEqual(next.taskControl.executionScope.allowedArtifactTypes,["plan"]);
  assert.equal(next.taskControl.readinessChecklist.find(x=>x.id==="authorization-confirmed").status,"not-assessed");
  assert.deepEqual(next.impact,record.impact);assert.deepEqual(next.documents,record.documents);
  const {validateTaskControl}=await import(path.join(businessRoot,"prototype/src/workflow/workflow-engine.js"));
  assert.deepEqual(validateTaskControl(next.taskControl,next.artifacts),[]);
  const done=analysisRecord(next,{...job,status:"completed",endedAt:now});
  assert.equal(done.taskControl.executionState,"waiting-human");assert.equal(done.currentStageId,"impact-analysis");assert.equal(done.confirmedAt,null);
  assert.deepEqual(validateTaskControl(done.taskControl,done.artifacts),[]);
});
test("CLI isolation has no write approval, browser, shell or connectors",()=>{
  const args=cliArgs("/tmp/fixture","/tmp/schema");
  assert(args.includes("read-only"));assert(args.includes('approval_policy="never"'));
  for(const key of ["shell_tool","apps","plugins","hooks","browser_use","multi_agent"])assert(args.includes(`features.${key}=false`));
  assert(!args.includes("--full-auto"));assert(!args.includes("danger-full-access"));
});
test("invalid result cannot be shown as valid analysis",()=>{
  assert.throws(()=>validateResult({summary:"x",scope:[]}));
});
test("durable job claim survives reload; corrupt or partial record fails closed",()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"analysis-persistence-test-"));
  atomicJson(path.join(directory,"run.json"),pending());assert.equal(readJob(directory).id,"fixture-run");
  const partial=fs.mkdtempSync(path.join(os.tmpdir(),"analysis-partial-test-"));assert.throws(()=>readJob(partial));
});
test("API rejects foreign origins, missing confirmation and stale source without launching",async()=>{
  let middleware;
  const runtime=fs.mkdtempSync(path.join(os.tmpdir(),"analysis-api-test-"));
  const registerResult=analysisPlugin(businessRoot,runtime).configureServer({middlewares:{use:fn=>{middleware=fn;return ()=>assert.fail("middleware is not a Vite post-hook");}}});
  assert.equal(registerResult,undefined);
  async function request(headers,body={}) {
    const req={url:"/api/analysis/cx-recycle/CR-029",method:"POST",headers,async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};
    let data;const res={setHeader(){},end(text){data=JSON.parse(text);}};
    await middleware(req,res,()=>assert.fail("unexpected route"));return {code:res.statusCode,data};
  }
  assert.equal((await request({host:"evil.test",origin:"http://evil.test"})).code,403);
  const headers={host:"127.0.0.1:5174",origin:"http://127.0.0.1:5174","content-type":"application/json"};
  assert.equal((await request(headers)).code,400);
  assert.equal((await request(headers,{sourceHash:"0".repeat(64),confirmAnalysisOnly:true})).code,409);
  assert(!fs.existsSync(path.join(runtime,ANALYSIS_ID)));
  const claim=path.join(runtime,ANALYSIS_ID);fs.mkdirSync(claim);atomicJson(path.join(claim,"run.json"),pending());
  const duplicate=await request(headers,{sourceHash:hash(fs.readFileSync(path.join(businessRoot,"docs/requirements/registry.json"),"utf8")),confirmAnalysisOnly:true});
  assert.equal(duplicate.code,200);assert.equal(duplicate.data.job.id,"fixture-run");
});
test("standalone worker completes with fake executor, preserves all other requirements and survives server-free execution",async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"analysis-worker-test-"));
  const project=path.join(directory,"project");const jobDir=path.join(directory,"job");fs.mkdirSync(jobDir);
  const files=["docs/requirements/registry.json","docs/requirements/page-document-map.json","docs/需求池.md","prototype/src/contracts/data/courier.js","prototype/src/courier/HomePage.jsx","prototype/src/courier/model.js","prototype/src/promotion-rules.js","docs/decisions/POSITIVE_DECISIONS.md","docs/decisions/NEGATIVE_DECISIONS.md"];
  for(const file of files){fs.mkdirSync(path.dirname(path.join(project,file)),{recursive:true});fs.copyFileSync(path.join(businessRoot,file),path.join(project,file));}
  atomicJson(path.join(project,"docs/requirements/registry.json"),registry);
  fs.mkdirSync(path.join(project,"prototype/scripts"),{recursive:true});
  fs.symlinkSync(path.join(businessRoot,"prototype/scripts/workflow-data.mjs"),path.join(project,"prototype/scripts/workflow-data.mjs"));
  const cli=path.join(directory,"fake-cli");fs.copyFileSync(fileURLToPath(new URL("./fixtures/fake-analysis-cli.mjs",import.meta.url)),cli);fs.chmodSync(cli,0o700);
  const raw=fs.readFileSync(path.join(project,"docs/requirements/registry.json"),"utf8");
  atomicJson(path.join(jobDir,"run.json"),{...pending(),sourceHash:hash(raw),recordHash:hash(record),projectRoot:project,cli});
  const child=spawn(process.execPath,[fileURLToPath(new URL("../server/analysis-worker.js",import.meta.url)),jobDir],{stdio:"pipe"});
  let stderr="";child.stderr.on("data",data=>stderr+=data);
  const code=await new Promise(resolve=>child.on("close",resolve));assert.equal(code,0,stderr);
  const job=readJob(jobDir);assert.equal(job.status,"completed",job.message);assert(job.registrySaved);assert.equal(job.result.summary,"测试分析结果");
  const next=JSON.parse(fs.readFileSync(path.join(project,"docs/requirements/registry.json"),"utf8"));
  assert.deepEqual(next.requirements.filter(x=>x.id!==ANALYSIS_ID),registry.requirements.filter(x=>x.id!==ANALYSIS_ID));
  assert.equal(next.requirements.find(x=>x.id===ANALYSIS_ID).taskControl.executionState,"waiting-human");
  assert.equal(fs.readFileSync(path.join(businessRoot,"docs/requirements/registry.json"),"utf8"),realSource,"real registry must not be changed");
});
