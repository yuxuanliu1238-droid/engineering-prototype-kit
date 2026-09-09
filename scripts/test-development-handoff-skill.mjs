import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

const skill = await fs.readFile(
  new URL("../skills/development-handoff/SKILL.md", import.meta.url),
  "utf8",
);
const workflow = await fs.readFile(
  new URL("../skills/development-handoff/references/handoff-workflow.md", import.meta.url),
  "utf8",
);
const orchestrator = await fs.readFile(
  new URL("../skills/prototype-sop-orchestrator/SKILL.md", import.meta.url),
  "utf8",
);
const combined = `${skill}\n${workflow}`;

for (const rule of [
  "Git 不是必选项",
  "不配置登录、不索取凭证、不写入令牌",
  "unverified",
  "changed",
  "missing",
  "只接受正式研发任务清单中的一个任务编号",
  "生成提示词不构成实施授权",
  "$change-and-delivery-governance",
  "scripts/generate-development-task-list.mjs",
  "scripts/validate-development-handoff.mjs",
  "scripts/generate-development-task-prompt.mjs",
]) {
  assert.equal(combined.includes(rule), true, `产研交接 Skill 缺少边界：${rule}`);
}

assert.match(combined, /钉钉文档允许肉眼查看/);
assert.match(combined, /changed.*missing.*停止生成/s);
assert.match(orchestrator, /\$development-handoff/);
assert.match(orchestrator, /返回 `\$change-and-delivery-governance` 核对七项就绪检查/);

for (const forbidden of ["自动实施", "自动确认正式清单", "必须上传 Git", "保存钉钉凭证"]) {
  assert.equal(combined.includes(forbidden), false, `产研交接 Skill 不得声明越界行为：${forbidden}`);
}

console.log("产研交接 Skill 测试通过：材料渠道中立、单任务隔离、版本状态和实施授权边界均有效。");
