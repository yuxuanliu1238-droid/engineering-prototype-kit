import { promises as fs } from "node:fs";
import path from "node:path";
import { printResult, readJson, ROOT } from "../project-lib.mjs";
import { renderRequirements, validateRegistryData } from "../workflow-v3-lib.mjs";
import { renderPageGuides, validateBusinessPageContracts } from "../page-guide-lib.mjs";

import {
  safeProjectPath,
  projectPathExists,
  handoffPaths,
  requireDevelopmentHandoff,
} from "./common.mjs";

export async function writeRequirements() {
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  if (status.currentMode !== "continuous-iteration") {
    throw new Error("快速验证模式没有正式 CR 台账，无需生成需求视图");
  }
  const registry = JSON.parse(
    await fs.readFile(safeProjectPath(config.paths.requirements), "utf8"),
  );
  const errors = validateRegistryData(registry);
  if (!printResult("需求台账生成前校验", errors, `${registry.items.length} 条需求`)) {
    throw new Error("需求台账未通过校验");
  }
  const target = safeProjectPath(config.paths.requirementsSummary);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderRequirements(registry), "utf8");
  console.log(`已生成：${config.paths.requirementsSummary}`);
}

export async function writePageGuides() {
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  if (status.currentMode !== "continuous-iteration") {
    throw new Error("快速验证模式不创建正式页面契约或页面说明");
  }
  const contractsPath = config.paths.contracts || "prototype/src/contracts/contracts.json";
  if (!(await projectPathExists(contractsPath))) {
    console.log("当前需求尚未触发正式页面契约，未生成页面说明。");
    return;
  }
  const registry = JSON.parse(
    await fs.readFile(safeProjectPath(config.paths.requirements), "utf8"),
  );
  const contracts = JSON.parse(await fs.readFile(safeProjectPath(contractsPath), "utf8"));
  const errors = [
    ...validateRegistryData(registry),
    ...validateBusinessPageContracts(contracts, registry, config),
  ];
  if (!printResult("页面说明生成前校验", errors, `${contracts.length} 个触达页面`)) {
    throw new Error("页面契约未通过校验");
  }
  const target = safeProjectPath(config.paths.pageGuides || "docs/page-guides/pages.md");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderPageGuides(contracts), "utf8");
  console.log(`已生成：${path.relative(ROOT, target)}`);
}

export async function writeDevelopmentHandoff() {
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  requireDevelopmentHandoff(status);
  const paths = handoffPaths(config);
  const { renderDevelopmentTaskList, summarizeTaskTypes, validateDevelopmentHandoff } =
    await import("../development-handoff-lib.mjs");
  const handoff = JSON.parse(await fs.readFile(safeProjectPath(paths.source), "utf8"));
  const errors = validateDevelopmentHandoff(handoff);
  if (
    !printResult(
      "研发任务清单生成前校验",
      errors,
      `${handoff.tasks?.length || 0} 项任务，${summarizeTaskTypes(handoff)}`,
    )
  ) {
    throw new Error("研发任务清单未通过校验");
  }
  const target = safeProjectPath(paths.view);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderDevelopmentTaskList(handoff), "utf8");
  console.log(`已生成：${paths.view}`);
}

export async function writeDevelopmentTaskPrompt(taskId) {
  if (!/^TASK-[A-Za-z0-9-]+$/.test(taskId || "")) {
    throw new Error("必须指定一个有效任务编号，例如 TASK-002");
  }
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  requireDevelopmentHandoff(status);
  const paths = handoffPaths(config);
  const handoff = JSON.parse(await fs.readFile(safeProjectPath(paths.source), "utf8"));
  const contextPath = `${paths.contexts}/${taskId}.json`;
  const context = JSON.parse(await fs.readFile(safeProjectPath(contextPath), "utf8"));
  const { renderDevelopmentTaskPrompt, validateTaskPromptContext } = await import(
    "../development-task-prompt-lib.mjs"
  );
  const errors = validateTaskPromptContext(handoff, taskId, context);
  if (
    !printResult(
      "单任务研发提示词生成前校验",
      errors,
      `${handoff.listId} ${handoff.version}，${taskId}`,
    )
  ) {
    throw new Error("单任务研发提示词未通过校验");
  }
  const outputPath = `${paths.prompts}/${taskId}.md`;
  const target = safeProjectPath(outputPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderDevelopmentTaskPrompt(handoff, taskId, context), "utf8");
  console.log(`已生成：${outputPath}`);
}
