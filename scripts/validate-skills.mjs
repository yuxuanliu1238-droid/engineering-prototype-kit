import { promises as fs } from "node:fs";
import path from "node:path";
import { printResult, ROOT } from "./project-lib.mjs";

const errors = [];
const skillsRoot = path.join(ROOT, "skills");
const entries = (await fs.readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name));
const boundaryPath = path.join(skillsRoot, "skill-boundaries.json");
const boundaries = JSON.parse(await fs.readFile(boundaryPath, "utf8"));
const baselineSkillNames = [
  "business-discovery",
  "change-and-delivery-governance",
  "decision-and-domain",
  "page-contract-and-spec",
  "prototype-sop-orchestrator",
  "requirement-quality-review",
];
const actualSkillNames = entries.map((entry) => entry.name);
const boundarySkillNames = boundaries.skills?.map((skill) => skill.name) ?? [];
const expectedSkillNames = [...boundarySkillNames].sort();

if (boundaries.schemaVersion !== 1) errors.push("skill-boundaries.json schemaVersion 必须为 1");
if (JSON.stringify(actualSkillNames) !== JSON.stringify(expectedSkillNames)) {
  errors.push("Skills 目录必须与 skill-boundaries.json 声明一致");
}
for (const name of baselineSkillNames) {
  if (!boundarySkillNames.includes(name)) errors.push(`skill-boundaries.json 缺少既有 Skill：${name}`);
}

const primaryResponsibilities = boundaries.skills?.map(
  (skill) => skill.primaryResponsibility,
) ?? [];
if (
  primaryResponsibilities.some((responsibility) => !responsibility) ||
  new Set(primaryResponsibilities).size !== primaryResponsibilities.length
) {
  errors.push("Skills 必须分别声明唯一主职责");
}
if (boundaries.skills?.filter((skill) => skill.role === "orchestrator").length !== 1) {
  errors.push("Skills 边界必须且只能包含一个 orchestrator");
}

const knownSkills = new Set(expectedSkillNames);
const candidateDecisions = new Set(["create", "planned", "do-not-create"]);
for (const candidate of boundaries.candidateDecisions ?? []) {
  if (!candidateDecisions.has(candidate.decision)) errors.push(`${candidate.name} 的候选决策无效`);
  const exists = actualSkillNames.includes(candidate.name);
  if (candidate.decision === "create" && !exists) errors.push(`${candidate.name} 已决定创建但缺少 Skill 目录`);
  if (candidate.decision !== "create" && exists) errors.push(`${candidate.name} 尚未决定创建，不得出现 Skill 目录`);
  if (candidate.ownedBy && !knownSkills.has(candidate.ownedBy)) {
    errors.push(`${candidate.name} 缺少有效的现有职责归属`);
  }
  if (candidate.coordinatedBy && !knownSkills.has(candidate.coordinatedBy)) {
    errors.push(`${candidate.name} 的协调 Skill 无效`);
  }
}

for (const capability of boundaries.deterministicCapabilities ?? []) {
  try {
    await fs.access(path.join(ROOT, capability.script));
  } catch {
    errors.push(`${capability.id} 引用不存在的确定性脚本：${capability.script}`);
  }
}

const shortDescriptions = [];
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
  shortDescriptions.push(shortDescription);
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

if (new Set(shortDescriptions).size !== shortDescriptions.length) {
  errors.push("Skills 的 short_description 必须互相区分");
}

printResult(
  "Skills 校验",
  errors,
  `${entries.length} 个 Skill 的唯一职责、候选决策、元数据、脚本边界和引用完整`,
);
