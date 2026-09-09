import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

const skill = await fs.readFile(new URL("../skills/prototype-sop-orchestrator/SKILL.md", import.meta.url), "utf8");
const stageMap = await fs.readFile(new URL("../skills/prototype-sop-orchestrator/references/stage-map.md", import.meta.url), "utf8");
const combined = `${skill}\n${stageMap}`;

const routes = [
  ["$business-discovery", "会议纪要"],
  ["$decision-and-domain", "状态"],
  ["$page-contract-and-spec", "页面说明"],
  ["$requirement-quality-review", "一致性"],
  ["$change-and-delivery-governance", "授权范围"],
  ["$prototype-change-retrospective", "复盘最近修改"],
  ["$scenario-evidence-capture", "是否可以评审"],
  ["$development-handoff", "研发任务清单"],
];

for (const [skillName, trigger] of routes) {
  assert.equal(combined.includes(skillName), true, `导航缺少专项 Skill：${skillName}`);
  assert.equal(combined.includes(trigger), true, `导航缺少自然语言触发描述：${trigger}`);
}

for (const boundary of [
  "不默认扫描整个仓库",
  "实际采集和索引仍交给确定性脚本",
  "不因登记或检查通过自动实施、关闭或交付",
]) {
  assert.equal(combined.includes(boundary), true, `导航缺少职责边界：${boundary}`);
}

for (const forbidden of ["固定业务状态", "特定角色端", "固定领域规则", "项目专属文案", "固定接口地址"]) {
  assert.equal(combined.includes(forbidden), false, `导航不得包含项目专属内容：${forbidden}`);
}

console.log("导航路由测试通过：八个专项 Skill、产研交接入口和确定性脚本边界均已覆盖。");
