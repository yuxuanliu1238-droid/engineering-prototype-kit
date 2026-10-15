import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {atomicJson,readJob} from "../server/analysis-core.js";
import {inspectKitJob} from "../server/kit-job-health.js";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"kit-job-health-")),old="2026-01-01T00:00:00.000Z";
function write(name,value){const directory=path.join(root,name);fs.mkdirSync(directory);atomicJson(path.join(directory,"run.json"),value);return directory;}

const alive=write("alive",{id:"alive",status:"running",createdAt:old,heartbeatAt:old,workerPid:process.pid});
const aliveResult=inspectKitJob(alive,{now:Date.parse("2026-01-01T00:02:00.000Z")});
assert.equal(aliveResult.status,"running");assert.equal(aliveResult.heartbeatDelayed,true);
assert.equal(readJob(alive).message,undefined,"live delayed job must not be rewritten as failed");

const dead=write("dead",{id:"dead",status:"running",createdAt:old,heartbeatAt:old,workerPid:2147483647});
const deadResult=inspectKitJob(dead,{now:Date.parse("2026-01-01T00:02:00.000Z")});
assert.equal(deadResult.status,"needs-attention");assert.equal(readJob(dead).status,"needs-attention");

const legacy=write("legacy",{id:"legacy",status:"submitted",createdAt:old,heartbeatAt:old});
const legacyResult=inspectKitJob(legacy,{now:Date.parse("2026-01-01T00:02:00.000Z")});
assert.equal(legacyResult.status,"needs-attention");assert.equal(legacyResult.retryable,false);
assert.equal(readJob(legacy).status,"submitted","legacy job without pid needs review but is not destructively rewritten");

const fresh=write("fresh",{id:"fresh",status:"submitted",createdAt:old,heartbeatAt:"2026-01-01T00:01:50.000Z"});
assert.equal(inspectKitJob(fresh,{now:Date.parse("2026-01-01T00:02:00.000Z")}).status,"submitted");

console.log("PASS: Kit job heartbeat distinguishes live delay, stopped process, legacy uncertainty and fresh work");
