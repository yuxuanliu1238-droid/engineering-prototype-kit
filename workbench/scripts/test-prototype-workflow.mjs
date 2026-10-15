import assert from "node:assert/strict";
import {prototypeWorkflow,validatePrototypeWorkflow} from "../src/prototype-workflow.js";

assert.equal(validatePrototypeWorkflow(),true);
assert.deepEqual(prototypeWorkflow.manualGates.map(item=>item.label),["确认业务方案","授权制作原型","确认原型并完成本轮"]);
assert(prototypeWorkflow.excluded.includes("正式研发"));
assert.equal(prototypeWorkflow.stages.find(item=>item.id==="prototype-building").primaryAction,null);
assert.match(prototypeWorkflow.questionPolicy.ask,/业务规则/);
console.log("PASS: product-manager engineering prototype workflow contract");
