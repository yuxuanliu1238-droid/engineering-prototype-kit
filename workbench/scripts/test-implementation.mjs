import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";
import {prepareImplementation,validateEdits,targets,IMPLEMENT_ENDPOINT,readRecord,readSafe} from "../server/implementation-core.js";
import {implementationPlugin} from "../server/implementation-api.js";
import {makeWorkflowRecord} from "./fixtures/workflow-record.mjs";
import {businessReview,saveBusinessDecisions} from "../server/business-decisions.js";
import {randomUUID} from "node:crypto";
const realRoot=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const fixture=fileURLToPath(new URL("./fixtures/fake-implementation-cli.mjs",import.meta.url));
const originals=new Map([...targets,"docs/requirements/registry.json"].map(file=>[file,fs.existsSync(path.join(realRoot,file))?fs.readFileSync(path.join(realRoot,file),"utf8"):null]));
function setup(){const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"implementation-test-"))),root=path.join(temp,"project"),runtime=path.join(temp,"runtime");
 const files=[...targets,"AGENTS.md","prototype/AGENTS.md","prototype/src/courier/model.js","prototype/src/promotion-rules.js","docs/decisions/NEGATIVE_DECISIONS.md","docs/requirements/registry.json","docs/requirements/page-document-map.json","docs/需求池.md"];
 for(const file of files){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});if(fs.existsSync(path.join(realRoot,file)))fs.copyFileSync(path.join(realRoot,file),path.join(root,file));}
 const registryPath=path.join(root,"docs/requirements/registry.json"),registry=JSON.parse(fs.readFileSync(registryPath,"utf8")),index=registry.requirements.findIndex(item=>item.id==="CR-029");let record=makeWorkflowRecord(registry.requirements[index],{answers:true,business:false}),review=businessReview(record);record=saveBusinessDecisions(record,{version:review.version,basis:review.basis,requestId:randomUUID(),confirmDecisionsOnly:true,items:review.recommendations.map(item=>({id:item.id,choice:"adopt"}))});registry.requirements[index]=record;fs.writeFileSync(registryPath,JSON.stringify(registry));
 fs.mkdirSync(path.join(root,"prototype/scripts"),{recursive:true});fs.symlinkSync(path.join(realRoot,"prototype/scripts/workflow-data.mjs"),path.join(root,"prototype/scripts/workflow-data.mjs"));
 const cli=path.join(temp,"fake-cli");fs.copyFileSync(fixture,cli);fs.chmodSync(cli,0o700);return {root,runtime,cli};}
test("preparation is prototype-specific and path/edit validation rejects unsafe writes",()=>{const {root,cli}=setup(),p=prepareImplementation(root,cli);assert(p.ready,p.blockers.join());assert.equal(p.plan.mode,"prototype-only");assert.throws(()=>validateEdits(p,{summary:"x",edits:[{path:"../evil",before:"",after:"x"}]}));assert.throws(()=>validateEdits(p,{summary:"x",edits:[{path:targets[0],before:"missing",after:"x"}]}));fs.unlinkSync(path.join(root,targets[1]));fs.symlinkSync(path.join(root,targets[0]),path.join(root,targets[1]));assert.throws(()=>readSafe(root,targets[1]));});
test("explicit authorization dispatches once; worker only edits authorized files and stops for review",async()=>{
 const {root,runtime,cli}=setup();let handler,args,count=0;const mount=()=>implementationPlugin(root,runtime,{cli,dispatch:(...a)=>{args=a;count++;return {on(){},unref(){}};}}).configureServer({middlewares:{use(fn){handler=fn;}}});mount();
 async function request(method,body={},origin="http://127.0.0.1:5174"){let data;const req={url:IMPLEMENT_ENDPOINT,method,headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={setHeader(){},end(x){data=JSON.parse(x);}};await handler(req,res,()=>assert.fail());return {code:res.statusCode,data};}
 const get=(await request("GET")).data,body={basis:get.basis,version:get.version,confirmPrototypeImplementation:true,acceptScopeAndRisk:true};
 assert.equal((await request("POST",body,"https://foreign.test")).code,403);assert.equal((await request("POST",{})).code,400);assert.equal((await request("POST",{...body,basis:"stale"})).code,409);assert.equal(count,0);
 const result=await request("POST",body);assert.equal(result.code,202,JSON.stringify(result.data));assert.equal(readRecord(root).taskControl.aiPolicy,"execution-allowed");
 assert.equal((await request("POST",body)).code,200);assert.equal(count,1);
 const child=spawn(args[0],args[1],{stdio:"pipe"});let err="";child.stderr.on("data",x=>err+=x);assert.equal(await new Promise(resolve=>child.on("close",resolve)),0,err);
 mount();const done=(await request("GET")).data;assert.equal(done.job.status,"completed",done.job.message);assert.deepEqual(done.changedFiles,[targets[0]]);assert.equal(readRecord(root).taskControl.executionState,"waiting-human");assert.notEqual(readRecord(root).currentStageId,"completed");
 for(const [file,original]of originals)assert.equal(fs.existsSync(path.join(realRoot,file))?fs.readFileSync(path.join(realRoot,file),"utf8"):null,original);
});
