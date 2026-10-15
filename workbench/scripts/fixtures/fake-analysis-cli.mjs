#!/usr/bin/env node
// Isolated protocol fixture. Never invokes a model or any business command.
process.stdin.resume();
process.stdin.on("end",()=>{
  const result={summary:"测试分析结果",facts:Array.from({length:6},(_,index)=>`测试事实 ${index+1}`),scope:["测试范围"],excluded:["不修改代码"],questions:["请确认测试范围"],acceptance:["可观察结果"],evidence:["测试材料"]};
  for(const event of [{type:"thread.started",thread_id:"fixture"},{type:"turn.started"},{type:"item.completed",item:{type:"agent_message",text:JSON.stringify(result)}},{type:"turn.completed"}]) process.stdout.write(JSON.stringify(event)+"\n");
});
