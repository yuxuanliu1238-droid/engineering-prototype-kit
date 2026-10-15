#!/usr/bin/env node
let text="";process.stdin.on("data",chunk=>text+=chunk);process.stdin.on("end",()=>{
 const data=JSON.parse(text.slice(text.indexOf("\n{")+1));const file=data.files.find(x=>x.path.endsWith("HomePage.jsx"));
 const result={summary:"隔离测试修改",edits:[{path:file.path,before:file.content,after:file.content+"\n// isolated fixture change\n"}]};
 for(const event of [{type:"turn.started"},{type:"item.completed",item:{type:"agent_message",text:JSON.stringify(result)}},{type:"turn.completed"}])process.stdout.write(JSON.stringify(event)+"\n");
});
