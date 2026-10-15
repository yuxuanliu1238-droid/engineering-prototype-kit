import test from "node:test";
import assert from "node:assert/strict";
import {buildRequirementActivity,formatActivityTime} from "../src/requirement-activity.js";

test("merges user and AI receipts into a descending activity timeline",()=>{
 const rows=buildRequirementActivity({
  record:{stages:[{id:"scope",label:"范围确认",updatedAt:"2026-09-11",note:"时间未记录"}]},
  analysis:{job:{message:"分析完成",events:[{time:"2026-09-11T06:00:00.000Z",label:"执行端已开始分析"}]}},
  questions:{review:{questions:[{text:"问题一",savedAt:"2026-09-11T07:01:01.000Z"},{text:"问题二",savedAt:"2026-09-11T07:02:02.000Z"}],submission:{requestId:"s",submittedAt:"2026-09-11T07:03:03.000Z"}}},
  review:{job:{message:"核对完成",events:[{time:"2026-09-11T07:04:04.000Z",label:"核对结果已返回，等待审阅"}]}},
  business:{review:{receipt:{requestId:"d",confirmedAt:"2026-09-11T07:05:05.000Z",items:[1,2,3,4]}}},
  implementation:{job:{message:"实施中",events:[{time:"2026-09-11T07:06:06.000Z",label:"已明确授权本轮原型实施"}]}}
 });
 assert.equal(rows[0].title,"已授权制作原型");
 assert.equal(rows.find(row=>row.id==="answers").items.length,2);
 assert.equal(rows.filter(row=>row.id==="answers").length,1);
 assert.equal(rows.at(-1).title,"范围确认");
});

test("keeps missing time explicit and shows seconds for recorded events",()=>{
 assert.deepEqual(formatActivityTime(null),{date:"日期未记录",time:"具体时间未记录"});
 assert.equal(formatActivityTime("2026-09-11T07:06:06.000Z").time,"15:06:06");
});
