#!/usr/bin/env node
let text="";
process.stdin.on("data",chunk=>text+=chunk);
process.stdin.on("end",()=>{
  const data=JSON.parse(text.slice(text.indexOf("\n{")+1));
  const file=data.files.find(item=>item.path.endsWith("-delivery.md"));
  const result={summary:"隔离测试：规则成果已整理",edits:[{path:file.path,before:file.content||"",after:file.content?file.content+"\n## 调整\n同范围意见已纳入。\n":"# 业务规则调整\n\n## 目标\n隔离测试。\n\n## 规则\n按已确认方案处理。\n\n## 验收\n核对正反例。\n"}]};
  for(const event of [{type:"turn.started"},{type:"item.completed",item:{type:"agent_message",text:JSON.stringify(result)}},{type:"turn.completed"}])
    process.stdout.write(JSON.stringify(event)+"\n");
});
