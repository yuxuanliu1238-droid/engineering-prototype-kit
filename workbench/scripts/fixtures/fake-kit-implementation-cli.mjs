#!/usr/bin/env node
let text="";process.stdin.on("data",chunk=>text+=chunk);
process.stdin.on("end",()=>{
  const frontend=text.includes('"frontend-page"'),thirdRequirement=text.includes("调整旧页面展示");
  const outOfScope=text.includes("新增外部接口"),adjustment=text.includes("同范围调整意见");
  const result={summary:outOfScope?"调整意见超出原范围":frontend?"已调整订单页面原型与需求说明":"已整理后台规则判断表与核对用例",
    scopeAssessment:{withinScope:!outOfScope,reason:outOfScope?"新增外部接口属于新的影响载体":"仅修改原授权文件并保持业务目标不变"},
    deliveryMarkdown:frontend?"# 订单状态展示调整\n\n## 目标与范围\n把已有状态改成六个展示标签。\n\n## 页面调整说明与前后对照\n旧入口保留。\n\n## 验收\n六个标签可切换到已有数据。\n":
      "# 黑名单校验调整\n\n## 规则定义\n仅调整黑名单拒绝条件。\n\n## 判断表\n列出允许和拒绝两类例子。\n\n## 核对用例\n正反例可复核。\n",
    fileEdits:outOfScope?[]:frontend?[{path:"prototype/src/OrderPage.jsx",content:`// 订单状态标签已调整为六个展示分组${adjustment?"，并优化选中态":""}${thirdRequirement?"，并完成本轮回归调整":""}\nexport default function OrderPage(){return null}\n`}]:[]};
  for(const event of [{type:"turn.started"},{type:"item.completed",item:{type:"agent_message",text:JSON.stringify(result)}},{type:"turn.completed"}])
    process.stdout.write(JSON.stringify(event)+"\n");
});
