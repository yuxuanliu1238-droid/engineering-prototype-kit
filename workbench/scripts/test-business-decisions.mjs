import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {businessReview,saveBusinessDecisions,authorizeImplementation,DECISIONS_ENDPOINT,AUTHORIZATION_ENDPOINT} from "../server/business-decisions.js";
import {scopePlugin} from "../server/scope-confirmation.js";
import {reviewIdentity} from "../server/answer-review.js";
import {hash} from "../server/analysis-core.js";
import {makeWorkflowRecord} from "./fixtures/workflow-record.mjs";
const root=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const raw=fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8");
const registry=JSON.parse(raw),source=registry.requirements.find(item=>item.id==="CR-029"),record=makeWorkflowRecord(source,{answers:true,business:false});
registry.requirements[registry.requirements.findIndex(item=>item.id==="CR-029")]=record;
function input(r=record){const v=businessReview(r);return {version:v.version,basis:v.basis,requestId:randomUUID(),confirmDecisionsOnly:true,items:v.recommendations.map(item=>({id:item.id,choice:"adopt"}))};}
test("explicit decisions are exact, idempotent, retain answers and never grant implementation",()=>{
 const body=input(),saved=saveBusinessDecisions(record,body),view=businessReview(saved);
 assert.equal(view.receipt.items.length,4);assert.equal(saveBusinessDecisions(saved,body),saved);
 assert.equal(saved.taskControl.aiPolicy,"planning-only");assert.equal(saved.taskControl.executionState,"waiting-human");assert.equal(saved.taskControl.executionScope.mode,record.taskControl.executionScope.mode);assert.deepEqual(saved.workbenchQuestionAnswers,record.workbenchQuestionAnswers);
 assert.deepEqual(saved.taskControl.readinessChecklist.find(item=>item.id==="authorization-confirmed"),record.taskControl.readinessChecklist.find(item=>item.id==="authorization-confirmed"));
 assert.equal(view.canAuthorize,false);assert(view.blockers.includes("尚未单独授权制作工程化原型"));assert.throws(()=>authorizeImplementation(saved,{confirm:true}));
});
test("missing choices, stale versions, changed answers, tampered recommendations fail closed",()=>{
 for(const patch of [{confirmDecisionsOnly:false},{version:"old"},{basis:"old"},{items:[]},{items:[...input().items.slice(0,3),input().items[0]]}])assert.throws(()=>saveBusinessDecisions(record,{...input(),...patch}));
 const body=input();body.items[0].text="remove all authentication";
 assert.equal(businessReview(saveBusinessDecisions(record,body)).receipt.items[0].text,businessReview(record).recommendations[0].recommendation);
 const next=structuredClone(record);next.workbenchQuestionAnswers.at(-1).answer+=" change";assert.throws(()=>saveBusinessDecisions(next,input()));
});
test("custom opinions are retained for review, not interpreted as technical permission",()=>{
 const body=input();body.items[0]={id:"visibility",choice:"custom",text:"只展示姓名"};
 const view=businessReview(saveBusinessDecisions(record,body));assert.equal(view.receipt.items[0].text,"只展示姓名");assert(view.blockers.includes("修改后的业务意见需由 AI 再次核对"));
});
test("isolated HTTP save survives reload and denies authorization and foreign origin",async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"business-decision-test-")),project=path.join(dir,"project"),runtime=path.join(dir,"runtime");
 for(const file of ["docs/requirements/registry.json","docs/requirements/page-document-map.json","docs/需求池.md"]){fs.mkdirSync(path.dirname(path.join(project,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(project,file));}
 fs.writeFileSync(path.join(project,"docs/requirements/registry.json"),JSON.stringify(registry));
 fs.mkdirSync(path.join(project,"prototype/scripts"),{recursive:true});fs.symlinkSync(path.join(root,"prototype/scripts/workflow-data.mjs"),path.join(project,"prototype/scripts/workflow-data.mjs"));
 const identity=reviewIdentity(record),reviewDir=path.join(runtime,`review-${identity.key}`);fs.mkdirSync(reviewDir,{recursive:true});fs.writeFileSync(path.join(reviewDir,"run.json"),JSON.stringify({id:randomUUID(),kind:"answer-review",status:"completed",recordHash:hash(record),message:"核对完成",events:[],result:{summary:"核对完成",facts:[],questions:[],acceptance:[],evidence:[],scope:[],excluded:[]}}));
 let handler;const mount=()=>scopePlugin(project,runtime).configureServer({middlewares:{use(fn){handler=fn;}}});mount();
 async function request(url,method,body,origin="http://127.0.0.1:5174"){let data;const req={url,method,headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};const res={setHeader(){},end(value){data=JSON.parse(value);}};await handler(req,res,()=>assert.fail());return {code:res.statusCode,data};}
 assert.equal((await request(DECISIONS_ENDPOINT,"POST",input(),"https://foreign.test")).code,403);
 const body=input();const saved=await request(DECISIONS_ENDPOINT,"POST",body);assert.equal(saved.code,200,JSON.stringify(saved.data));
 mount();assert((await request(DECISIONS_ENDPOINT,"GET")).data.review.receipt);
 assert.equal((await request(DECISIONS_ENDPOINT,"POST",body)).code,200);
 assert.equal((await request(AUTHORIZATION_ENDPOINT,"POST",{confirm:true})).code,409);
 assert.equal(fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8"),raw);
});
