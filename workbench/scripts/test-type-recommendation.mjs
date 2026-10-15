import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {typeRecommendationPlugin} from "../server/type-recommendation-api.js";

const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"type-recommendation-test-"))),
  fake=fileURLToPath(new URL("./fixtures/fake-type-cli.mjs",import.meta.url)),cli=path.join(temp,"fake-cli");
fs.copyFileSync(fake,cli);fs.chmodSync(cli,0o700);
let handler,args,dispatches=0;
typeRecommendationPlugin(temp,{cli,dispatch:(...values)=>{args=values;dispatches++;return {on(){},unref(){}};}})
  .configureServer({middlewares:{use(fn){handler=fn;}}});
async function request(method,url,body={},origin="http://127.0.0.1:5174"){
  let data;const req={url,method,headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await handler(req,res,()=>assert.fail("type route not matched"));return {status:res.statusCode,data};
}
const id=randomUUID(),input={requestId:id,projectName:"隔离项目",description:"把订单现有状态重新分组显示，不改状态含义",confirmRecommendationOnly:true};
assert.equal((await request("POST","/api/type-recommendations",input,"https://other.test")).status,403);
assert.equal((await request("POST","/api/type-recommendations",{...input,confirmRecommendationOnly:false})).status,400);
assert.equal((await request("POST","/api/type-recommendations",input)).status,202);
assert.equal((await request("POST","/api/type-recommendations",input)).status,200);
assert.equal(dispatches,1);
const child=spawn(args[0],args[1],{stdio:"pipe"});let diagnostics="";child.stderr.on("data",chunk=>diagnostics+=chunk);
assert.equal(await new Promise(resolve=>child.on("close",resolve)),0,diagnostics);
const result=await request("GET",`/api/type-recommendations/${id}`);
assert.equal(result.status,200);assert.equal(result.data.job.status,"completed");
assert.equal(result.data.job.recommendation.mainType,"existing-page-adjustment");
assert(result.data.job.recommendation.impactTags.includes("frontend-page"));
assert.equal(result.data.job.recommendation.suggestSplit,false);
console.log("PASS: explicit read-only AI type suggestion, semantic reason, no duplicate dispatch");
