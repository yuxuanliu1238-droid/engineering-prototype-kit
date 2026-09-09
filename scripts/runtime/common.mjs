import { safePath } from "../safe-path.mjs";

import { promises as fs } from "node:fs";

import { ROOT } from "../project-lib.mjs";

export function safeProjectPath(relativePath) {
  return safePath(ROOT, relativePath);
}

export async function projectPathExists(relativePath) {
  try {
    await fs.access(safeProjectPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export function handoffPaths(config) {
  return {
    source: config.paths.developmentHandoff || "docs/development/development-handoff.json",
    view: config.paths.developmentTaskList || "docs/development/development-task-list.md",
    contexts: config.paths.developmentTaskContexts || "docs/development/task-contexts",
    prompts: config.paths.developmentTaskPrompts || "docs/development/task-prompts",
  };
}

export function requireDevelopmentHandoff(status) {
  if (status.currentMode !== "continuous-iteration") {
    throw new Error("产研交接只适用于持续迭代项目");
  }
  if (status.capabilities?.developmentHandoff?.enabled !== true) {
    throw new Error("当前项目未启用产研交接，不需要生成研发任务材料");
  }
}
