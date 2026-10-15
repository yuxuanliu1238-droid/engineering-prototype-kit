#!/usr/bin/env node
let text="";process.stdin.on("data",chunk=>text+=chunk);
process.stdin.on("end",()=>{
  const result={summary:"建议把已有订单状态重新分组显示，状态本身不变。",facts:["当前是隔离项目资料，未接生产数据。"],
    scope:["调整已有页面展示分组"],excluded:["不新增业务状态"],
    questions:[{question:"是否保留原标签入口？",recommendation:"保留",impact:"旧入口不会突然消失"}],
    acceptance:["六个标签均可切换到已有状态数据"],evidence:["项目台账中的原始需求与需求类型"],
    risk:{level:"light",triggers:[],rationale:"隔离场景仅调整已有页面展示，状态含义不变"},
    targets:["prototype/src/OrderPage.jsx"]};
  for(const event of [{type:"turn.started"},{type:"item.completed",item:{type:"agent_message",text:JSON.stringify(result)}},{type:"turn.completed"}])
    process.stdout.write(JSON.stringify(event)+"\n");
});
