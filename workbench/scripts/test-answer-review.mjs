import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";
import {reviewPlugin,reviewIdentity,REVIEW_ENDPOINT} from "../server/answer-review.js";
import {hash,readJob} from "../server/analysis-core.js";
import {makeWorkflowRecord} from "./fixtures/workflow-record.mjs";
const root=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const raw=fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8");
const registry=JSON.parse(raw),source=registry.requirements.find(x=>x.id==="CR-029"),record=makeWorkflowRecord(source,{answers:true});
registry.requirements[registry.requirements.findIndex(x=>x.id==="CR-029")]=record;
test("only submitted current answers are eligible and changed answers change identity",()=>{
  assert(reviewIdentity(record).eligible);
  const next=structuredClone(record);delete next.workbenchAnswerSubmissions;assert(!reviewIdentity(next).eligible);
  const edited=structuredClone(record);edited.workbenchQuestionAnswers.at(-1).answer+=" changed";
  assert(!reviewIdentity(edited).eligible);assert.notEqual(reviewIdentity(record).key,reviewIdentity(edited).key);
});
test("review dispatch is explicit, idempotent, isolated and durable; stale results are marked",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"answer-review-test-")),project=path.join(dir,"project"),runtime=path.join(dir,"runtime");
  const files=["docs/requirements/registry.json","prototype/src/contracts/data/courier.js","prototype/src/courier/HomePage.jsx","prototype/src/courier/model.js","prototype/src/promotion-rules.js","docs/decisions/POSITIVE_DECISIONS.md","docs/decisions/NEGATIVE_DECISIONS.md"];
  for(const file of files){fs.mkdirSync(path.dirname(path.join(project,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(project,file));}
  fs.writeFileSync(path.join(project,"docs/requirements/registry.json"),JSON.stringify(registry));
  const cli=path.join(dir,"fake-cli");fs.copyFileSync(fileURLToPath(new URL("./fixtures/fake-analysis-cli.mjs",import.meta.url)),cli);fs.chmodSync(cli,0o700);
  let handler,count=0,args;
  const mount=()=>reviewPlugin(project,runtime,{cli,dispatch:(...input)=>{count++;args=input;return {on(){},unref(){}};}}).configureServer({middlewares:{use(fn){handler=fn;}}});mount();
  async function request(method="GET",body={},origin="http://127.0.0.1:5174"){
    let data;const req={url:REVIEW_ENDPOINT,method,headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};
    const res={setHeader(){},end(text){data=JSON.parse(text);}};await handler(req,res,()=>assert.fail());return {code:res.statusCode,data};
  }
  const initial=(await request()).data,body={key:initial.key,version:initial.version,confirmReviewOnly:true};
  assert.equal((await request("POST",body,"https://foreign.test")).code,403);
  assert.equal((await request("POST",{})).code,400);
  assert.equal((await request("POST",{...body,version:"stale"})).code,409);assert.equal(count,0);
  const started=await request("POST",body);assert.equal(started.code,202);
  assert.equal((await request("POST",body)).data.job.id,started.data.job.id);assert.equal(count,1);
  const child=spawn(args[0],args[1],{stdio:"pipe"});let stderr="";child.stderr.on("data",chunk=>stderr+=chunk);
  assert.equal(await new Promise(resolve=>child.on("close",resolve)),0,stderr);
  mount();const done=(await request()).data;
  assert.equal(done.job.status,"completed",done.job.message);assert(done.job.result);assert(!done.canStart);assert(!done.stale);
  const fixtureRaw=JSON.stringify(registry);assert.equal(fs.readFileSync(path.join(project,files[0]),"utf8"),fixtureRaw,"review never rewrites business registry");
  fs.appendFileSync(path.join(project,files[1]),"\n// changed fixture");assert((await request()).data.stale);
  const persisted=readJob(args[1][1]);assert.equal(persisted.kind,"answer-review");assert.equal(persisted.recordHash,hash(record));
  assert.equal(fs.readFileSync(path.join(root,files[0]),"utf8"),raw,"real business stays unchanged");
});
