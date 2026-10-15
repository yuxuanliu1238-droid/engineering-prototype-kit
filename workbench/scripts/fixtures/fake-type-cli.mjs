#!/usr/bin/env node
let text="";
process.stdin.on("data",chunk=>text+=chunk);
process.stdin.on("end",()=>{
  const input=JSON.parse(text.slice(text.lastIndexOf("\n{")+1));
  const result={causes:[
    {type:"existing-page-adjustment",essential:true,reason:"只把已有状态重新分组展示，状态含义和流转不变"},
    {type:"state-data-definition",essential:false,reason:"现有状态本身没有变化"},
  ],impactTags:["frontend-page","requirement-document"],parts:[]};
  if(!input.description.includes("分组"))result.causes[0].reason="隔离测试按既有页面呈现变化判断";
  for(const event of [{type:"turn.started"},{type:"item.completed",item:{type:"agent_message",text:JSON.stringify(result)}},{type:"turn.completed"}])
    process.stdout.write(JSON.stringify(event)+"\n");
});
