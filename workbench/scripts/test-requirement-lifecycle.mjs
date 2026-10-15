import assert from "node:assert/strict";
import {initialLifecycle,transitionLifecycle,validLifecycle} from "../src/requirement-lifecycle.js";

let record={workbenchLifecycle:initialLifecycle("2026-09-15T00:00:00.000Z")};
for(const [state,actor] of [
  ["awaiting-plan","AI 执行端"],
  ["awaiting-authorization","产品经理"],
  ["executing","产品经理"],
  ["awaiting-review","AI 执行端"],
  ["executing","产品经理"],
  ["awaiting-review","AI 执行端"],
  ["completed","产品经理"],
]){
  record=transitionLifecycle(record,state,{time:"2026-09-15T01:00:00.000Z",actor,event:state});
  assert(validLifecycle(record.workbenchLifecycle));
}
assert.equal(record.workbenchLifecycle.state,"completed");
assert.throws(()=>transitionLifecycle(record,"executing"),/INVALID_LIFECYCLE_TRANSITION/);
console.log("PASS: one lifecycle, separate authorization, adjustment loop, terminal completion");
