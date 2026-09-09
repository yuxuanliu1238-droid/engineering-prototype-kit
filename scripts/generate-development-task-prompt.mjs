import { safePath as projectPath } from "./safe-path.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printResult, ROOT } from "./project-lib.mjs";
import {
  renderDevelopmentTaskPrompt,
  validateTaskPromptContext,
} from "./development-task-prompt-lib.mjs";

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!["--input", "--task", "--context", "--output"].includes(key) || !args[index + 1]) {
      throw new Error(`参数无效：${key || "缺失"}`);
    }
    values[key.slice(2)] = args[index + 1];
  }
  return values;
}

function safePath(relativePath) {
  return projectPath(ROOT, relativePath);
}

export async function generateDevelopmentTaskPrompt({ input, task, context, output }) {
  if (!input || !task || !context || !output)
    throw new Error("必须提供 --input、--task、--context 和 --output");
  const handoff = JSON.parse(await fs.readFile(safePath(input), "utf8"));
  const taskContext = JSON.parse(await fs.readFile(safePath(context), "utf8"));
  const errors = validateTaskPromptContext(handoff, task, taskContext);
  if (
    !printResult(
      "单任务研发提示词生成前校验",
      errors,
      `${handoff.listId} ${handoff.version}，${task}`,
    )
  ) {
    throw new Error("单任务研发提示词未通过校验");
  }
  const target = safePath(output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderDevelopmentTaskPrompt(handoff, task, taskContext), "utf8");
  return target;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const target = await generateDevelopmentTaskPrompt(args);
  console.log(`已生成：${path.relative(ROOT, target)}`);
}
