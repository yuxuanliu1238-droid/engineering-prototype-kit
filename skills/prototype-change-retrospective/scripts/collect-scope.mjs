import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

function pathLike(value) {
  if (typeof value !== "string") return false;
  if (/^(registry:|https?:|[A-Za-z]+:)/.test(value)) return false;
  if (!value.includes("/") || value.includes("\n") || value.length > 240) return false;
  if (/[；。，：“”]/.test(value) || /^\d{4}-\d{2}-\d{2}\s/.test(value)) return false;
  return true;
}

function addPath(target, value) {
  if (pathLike(value)) target.add(value.replace(/^\.\//, "").split("#")[0]);
}

export function collectRequirementReferences(requirement) {
  const references = new Set();
  for (const document of requirement.documents ?? []) addPath(references, document);
  for (const artifact of requirement.artifacts ?? []) {
    addPath(references, artifact.location);
    for (const sourceRef of artifact.sourceRefs ?? []) addPath(references, sourceRef.location);
  }
  for (const item of requirement.evidence ?? []) addPath(references, item.reference);
  for (const check of requirement.taskControl?.readinessChecklist ?? []) {
    for (const evidence of check.evidence ?? []) addPath(references, evidence);
  }
  return [...references].sort();
}

export function selectRelatedChangedFiles(referencedFiles, changedFiles) {
  const normalizedReferences = referencedFiles.map((filename) => filename.replace(/^\.\//, "").split("#")[0]);
  return [...new Set(changedFiles)]
    .filter((filename) => {
      const normalized = filename.replace(/^\.\//, "");
      return normalizedReferences.some((reference) => normalized === reference || (reference.endsWith("/") && normalized.startsWith(reference)));
    })
    .sort();
}

async function listWorktreeChanges(repoRoot) {
  const [{ stdout: tracked }, { stdout: untracked }] = await Promise.all([
    execFileAsync("git", ["-C", repoRoot, "diff", "--name-only", "--"]),
    execFileAsync("git", ["-C", repoRoot, "ls-files", "--others", "--exclude-standard"]),
  ]);
  return `${tracked}\n${untracked}`.split(/\r?\n/).filter(Boolean);
}

async function listTimeChanges(repoRoot, from, to) {
  const args = ["-C", repoRoot, "log", "--name-only", "--pretty=format:", `--since=${from}`];
  if (to) args.push(`--until=${to}`);
  const { stdout } = await execFileAsync("git", args);
  return [...new Set(stdout.split(/\r?\n/).filter(Boolean))].sort();
}

export async function collectScope({ registryPath, requirementId, repoRoot, from, to }) {
  if (requirementId) {
    if (!registryPath) throw new Error("CR 模式必须提供 --registry");
    const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
    const requirement = registry.requirements?.find((item) => item.id === requirementId);
    if (!requirement) throw new Error(`未找到需求：${requirementId}`);
    const referencedFiles = collectRequirementReferences(requirement);
    const changedFiles = repoRoot ? await listWorktreeChanges(repoRoot) : [];
    const relatedChangedFiles = selectRelatedChangedFiles(referencedFiles, changedFiles);
    return {
      selector: { kind: "requirement", requirementId },
      title: requirement.title,
      currentStageId: requirement.currentStageId,
      referencedFiles,
      relatedChangedFiles,
      excludedChangedFileCount: Math.max(0, new Set(changedFiles).size - relatedChangedFiles.length),
    };
  }
  if (!from) throw new Error("必须提供 --requirement 或 --from");
  if (!repoRoot) throw new Error("时间范围模式必须提供 --repo");
  return {
    selector: { kind: "time-range", from, to: to || null },
    changedFiles: await listTimeChanges(repoRoot, from, to),
  };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!["--registry", "--requirement", "--repo", "--from", "--to"].includes(token)) throw new Error(`未知参数：${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`);
    result[token.slice(2)] = value;
    index += 1;
  }
  return result;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await collectScope({
      registryPath: args.registry ? path.resolve(args.registry) : null,
      requirementId: args.requirement,
      repoRoot: args.repo ? path.resolve(args.repo) : null,
      from: args.from,
      to: args.to,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
