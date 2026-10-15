import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scopeReview,confirmScopeRecord,scopePlugin,SCOPE_ENDPOINT } from "../server/scope-confirmation.js";
import {makeWorkflowRecord} from "./fixtures/workflow-record.mjs";
const root=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const source=fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8");
const registry=JSON.parse(source);
const sourceRecord=registry.requirements.find(item=>item.id==="CR-029"),record=makeWorkflowRecord(sourceRecord,{answers:false});
delete record.workbenchScopeConfirmation;
registry.requirements[registry.requirements.findIndex(item=>item.id==="CR-029")]=record;
const input=()=>({...scopeReview(record),confirmScopeOnly:true,result:undefined});

test("confirmation stores exact scope and exclusions but not implementation or rule approval",async()=>{
  const next=confirmScopeRecord(record,input());
  assert.deepEqual(next.workbenchScopeConfirmation.scope,record.workbenchAnalysis.result.scope);
  assert.deepEqual(next.workbenchScopeConfirmation.excluded,record.workbenchAnalysis.result.excluded);
  assert.equal(next.workbenchScopeConfirmation.implementationAuthorized,false);
  assert.equal(next.taskControl.aiPolicy,"planning-only");assert.equal(next.confirmedAt,null);
  assert.equal(next.currentStageId,record.currentStageId);
  assert.equal(next.taskControl.executionState,"waiting-human");
  assert.equal(next.taskControl.readinessChecklist.find(x=>x.id==="scope-clear").status,"met");
  for(const id of ["rules-confirmed","authorization-confirmed","acceptance-testable"])assert.deepEqual(next.taskControl.readinessChecklist.find(x=>x.id===id),record.taskControl.readinessChecklist.find(x=>x.id===id));
  assert(next.pendingQuestions.includes(record.workbenchAnalysis.result.questions[0]));
  const {validateTaskControl}=await import(path.join(root,"prototype/src/workflow/workflow-engine.js"));
  assert.deepEqual(validateTaskControl(next.taskControl,next.artifacts),[]);
});
test("repeated confirmation preserves the first receipt and time",()=>{
  const first=confirmScopeRecord(record,input(),"2026-09-10T12:00:00Z");
  assert.equal(confirmScopeRecord(first,input(),"2026-09-10T13:00:00Z"),first);
});
test("stale record, changed result, wrong run and missing explicit consent are rejected",()=>{
  for(const patch of [{version:"stale"},{analysisId:"different"},{resultHash:"different"},{confirmScopeOnly:false}])assert.throws(()=>confirmScopeRecord(record,{...input(),...patch}));
  const changed=structuredClone(record);changed.workbenchAnalysis.result.scope.push("changed");
  assert.throws(()=>confirmScopeRecord(changed,input()));
  for(const status of ["running","failed","submitted"]){const item=structuredClone(record);item.workbenchAnalysis.status=status;assert.throws(()=>scopeReview(item));}
});
test("only scope check changes; impact and other business data remain untouched",()=>{
  const next=confirmScopeRecord(record,input());
  for(const key of ["notes","impact","documents","decisionIds","artifacts","confirmedAt","workbenchAnalysis"])assert.deepEqual(next[key],record[key]);
});
test("API persists into isolated source, denies cross-origin, rejects stale versions, survives reload",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"scope-confirm-test-"));
  const project=path.join(dir,"project"),runtime=path.join(dir,"runtime");
  for(const file of ["docs/requirements/registry.json","docs/requirements/page-document-map.json","docs/需求池.md"]){fs.mkdirSync(path.dirname(path.join(project,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(project,file));}
  fs.writeFileSync(path.join(project,"docs/requirements/registry.json"),JSON.stringify(registry));
  fs.mkdirSync(path.join(project,"prototype/scripts"),{recursive:true});fs.symlinkSync(path.join(root,"prototype/scripts/workflow-data.mjs"),path.join(project,"prototype/scripts/workflow-data.mjs"));
  function mount(){let handler;assert.equal(scopePlugin(project,runtime).configureServer({middlewares:{use(fn){handler=fn;return ()=>{};}}}),undefined);return handler;}
  let handler=mount();
  async function request(method,body,origin="http://127.0.0.1:5174"){
    let data;const req={url:SCOPE_ENDPOINT,method,headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};
    const res={setHeader(){},end(text){data=JSON.parse(text);}};await handler(req,res,()=>assert.fail("wrong route"));return {code:res.statusCode,data};
  }
  assert.equal((await request("POST",input(),"https://foreign.example")).code,403);
  assert.equal((await request("POST",{...input(),version:"stale"})).code,409);
  assert.equal((await request("POST",{...input(),result:undefined})).code,200);
  handler=mount();const reread=await request("GET");assert(reread.data.review.confirmation);
  const duplicate=await request("POST",{...input(),result:undefined});assert.equal(duplicate.code,200);assert.equal(duplicate.data.review.confirmation.id,reread.data.review.confirmation.id);
  const actual=JSON.parse(fs.readFileSync(path.join(project,"docs/requirements/registry.json"),"utf8"));
  assert.deepEqual(actual.requirements.filter(x=>x.id!=="CR-029"),registry.requirements.filter(x=>x.id!=="CR-029"));
  assert.equal(fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8"),source);
});
