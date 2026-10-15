import test from "node:test";
import assert from "node:assert/strict";
import snapshot from "../src/requirement-details.json" with {type:"json"};
import { validateSourceSnapshot,sourceChanges,fetchAndSaveSource,readCachedSource,SOURCE_CACHE_KEY } from "../src/source-refresh.js";
import { sourceReaderPlugin } from "../server/source-reader.js";

function storageWith(value) {let raw=JSON.stringify(value);return {getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,SOURCE_CACHE_KEY);raw=value;}};}
test("valid cached snapshot survives reopening",()=>{
  assert.deepEqual(readCachedSource(storageWith(snapshot),snapshot).snapshot,snapshot);
});
test("invalid cache preserves raw data and falls back",()=>{
  const storage={getItem:()=>"broken",setItem:()=>assert.fail("must not overwrite")};
  const loaded=readCachedSource(storage,snapshot);assert.equal(loaded.snapshot,snapshot);assert(loaded.warning);
});
test("changes distinguish addition update removal and timestamp-only refresh",()=>{
  const next=structuredClone(snapshot);next.readAt=new Date().toISOString();
  assert.deepEqual(sourceChanges(snapshot,next),{added:[],updated:[],removed:[]});
  next.items.shift();next.items[0].note="测试变更";next.items.push({...next.items[0],id:"CR-TEST"});
  const diff=sourceChanges(snapshot,next);assert.equal(diff.added.length,1);assert.equal(diff.updated.length,1);assert.equal(diff.removed.length,1);
});
test("refresh validates and saves before replacing the snapshot",async()=>{
  const storage=storageWith(snapshot);const next=structuredClone(snapshot);next.readAt=new Date().toISOString();
  const result=await fetchAndSaveSource({fetcher:async(url,options)=>{assert.equal(options.method,"GET");return {ok:true,json:async()=>next};},storage,previous:snapshot});
  assert.deepEqual(JSON.parse(storage.getItem()),result.snapshot);
});
test("network invalid response storage error and abort retain old cache",async()=>{
  for(const failure of ["network","invalid","storage","abort"]) {
    const storage=storageWith(snapshot);const original=storage.getItem();
    if(failure==="storage")storage.setItem=()=>{throw Error("quota");};
    const abort=new AbortController();if(failure==="abort")abort.abort();
    await assert.rejects(fetchAndSaveSource({fetcher:async()=>{if(failure==="network")throw Error("offline");return {ok:true,json:async()=>failure==="invalid"?{}:snapshot};},storage,previous:snapshot,signal:abort.signal}));
    assert.equal(storage.getItem(),original);
  }
});
test("reject malformed nested records and duplicate ids",()=>{
  for(const mutate of [x=>x.items.push(x.items[0]),x=>x.items[0].notes=[{}],x=>x.items[0].stages[0].note={},x=>x.projectId="other",x=>x.items[0].evidence[0].reference={}]) {
    const bad=structuredClone(snapshot);mutate(bad);assert.throws(()=>validateSourceSnapshot(bad));
  }
});
async function request(method,headers={},url="/api/read-only/cx-recycle/requirements") {
  let handler;sourceReaderPlugin("/nonexistent-cx-source-test").configureServer({middlewares:{use:fn=>handler=fn}});
  const result={statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body);}};
  await handler({method,url,headers:{host:"127.0.0.1:5174",...headers}},result,()=>assert.fail("unexpected route"));return result;
}
test("new API rejects writes cross-origin and path parameters",async()=>{
  assert.equal((await request("POST")).statusCode,405);
  assert.equal((await request("GET",{origin:"https://other.example"})).statusCode,403);
  assert.equal((await request("GET",{host:"other.example"})).statusCode,403);
  assert.equal((await request("GET",{},"/api/read-only/cx-recycle/requirements?path=/etc/passwd")).statusCode,400);
});
test("missing source returns sanitized failure",async()=>{
  const res=await request("GET");assert.equal(res.statusCode,503);assert.equal(res.body.error,"SOURCE_UNAVAILABLE");assert(!JSON.stringify(res.body).includes("nonexistent"));
});
