import { promises as fs } from "node:fs";
import path from "node:path";
import { printResult, ROOT } from "./project-lib.mjs";

const errors = [];
const skillsRoot = path.join(ROOT, "skills");
const entries = (await fs.readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name));

for (const entry of entries) {
  const skillRoot = path.join(skillsRoot, entry.name);
  const skillPath = path.join(skillRoot, "SKILL.md");
  const agentPath = path.join(skillRoot, "agents/openai.yaml");
  let skill;
  let agent;
  try {
    skill = await fs.readFile(skillPath, "utf8");
  } catch {
    errors.push(`${entry.name} 缺少 SKILL.md`);
    continue;
  }
  try {
    agent = await fs.readFile(agentPath, "utf8");
  } catch {
    errors.push(`${entry.name} 缺少 agents/openai.yaml`);
    continue;
  }

  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    errors.push(`${entry.name} 缺少 YAML frontmatter`);
    continue;
  }
  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter[1]
    .match(/^description:\s*([\s\S]+)$/m)?.[1]
    ?.trim();
  if (name !== entry.name) errors.push(`${entry.name} 的 name 与目录名不一致`);
  if (!description || description.length < 80) {
    errors.push(`${entry.name} 的 description 未充分说明功能和触发场景`);
  }
  if (/\[TODO|TODO:/i.test(skill)) errors.push(`${entry.name} 仍包含 TODO 占位`);

  const shortDescription = agent.match(/short_description:\s*"([^"]+)"/)?.[1];
  if (!shortDescription || shortDescription.length < 25 || shortDescription.length > 64) {
    errors.push(`${entry.name} 的 short_description 必须为 25–64 个字符`);
  }
  const defaultPrompt = agent.match(/default_prompt:\s*"([^"]+)"/)?.[1];
  if (!defaultPrompt?.includes(`$${entry.name}`)) {
    errors.push(`${entry.name} 的 default_prompt 必须显式引用 Skill`);
  }

  const references = [...skill.matchAll(/`references\/([^`]+)`/g)].map(
    (match) => match[1],
  );
  for (const reference of references) {
    try {
      await fs.access(path.join(skillRoot, "references", reference));
    } catch {
      errors.push(`${entry.name} 引用不存在：references/${reference}`);
    }
  }
}

printResult("Skills 校验", errors, `${entries.length} 个 Skill 的结构、元数据和引用完整`);
