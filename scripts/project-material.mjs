import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./project-lib.mjs";
import { safePath } from "./safe-path.mjs";
import { parseOptions } from "./cli-lib.mjs";
import { applyTransaction, previewGuard, restoreTransaction } from "./transaction-lib.mjs";
import { isMaterialActivation, selectActivationFiles } from "./template-manifest.mjs";
import { validateDocumentBaseline } from "./documents-validate.mjs";

const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const sha = (content) => createHash("sha256").update(content).digest("hex");
async function read(root, file) {
  try { return await fs.readFile(safePath(root, file)); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function prepareMaterial({ project, activation, apply = false, failAfter = 0 }) {
  const root = path.resolve(project);
  if (!isMaterialActivation(activation)) throw new Error("此入口只开放业务需求说明书和接口说明书，其他能力须使用对应门禁入口");
  const config = JSON.parse(await read(root, "project.config.json"));
  if (config.instanceKind !== "business-project") throw new Error("材料只能准备到独立业务项目");
  const manifest = JSON.parse(await read(root, ".prototype-kit/manifest.json"));
  const entries = selectActivationFiles(activation).map((entry) => ({
    ...entry, target: config.paths?.[entry.configKey] || entry.target,
  }));
  const destinations = entries.map((entry) => entry.target);
  if (new Set(destinations).size !== destinations.length) throw new Error("材料目标路径重复");
  const writes = [];
  const changes = [];
  for (const entry of entries) {
    safePath(root, entry.target);
    if (["project.config.json", ".prototype-kit/manifest.json"].includes(entry.target)) throw new Error("材料目标不得覆盖项目控制文件");
    const existing = await read(root, entry.target);
    if (existing !== null) {
      if (entry.activationId === activation) throw new Error(`目标已存在，禁止覆盖：${entry.target}`);
      const result = await validateDocumentBaseline(JSON.parse(existing), { root, source: entry.target });
      if (!result.valid) throw new Error(`已有文档基线无效：${result.issues.map((issue) => issue.reason).join("；")}`);
      changes.push({ path: entry.target, action: "preserved" });
      continue;
    }
    if (manifest.files.some((file) => file.path === entry.target)) throw new Error(`清单中的材料已缺失，请先恢复：${entry.target}`);
    const content = await fs.readFile(safePath(path.join(ROOT, "templates/business-project"), entry.source));
    writes.push([entry.target, content]);
    manifest.files.push({ path: entry.target, ownership: entry.ownership,
      source: entry.source, activationId: entry.activationId, sha256: sha(content) });
    changes.push({ path: entry.target, action: "created" });
  }
  config.paths ||= {};
  for (const entry of entries) config.paths[entry.configKey] = entry.target;
  manifest.files.sort((left, right) => left.path.localeCompare(right.path));
  const configContent = json(config);
  const configEntry = manifest.files.find((entry) => entry.path === "project.config.json");
  if (!configEntry || configEntry.ownership !== "kit-managed") throw new Error("项目配置缺少有效管理清单记录");
  configEntry.sha256 = sha(configContent);
  writes.push(["project.config.json", configContent], [".prototype-kit/manifest.json", json(manifest)]);
  const kind = `material-${activation}`;
  const expected = await previewGuard(root, kind,
    [...destinations, "project.config.json", ".prototype-kit/manifest.json"], apply);
  if (apply) await applyTransaction(root, kind, writes, { expected, failAfter });
  return { applied: apply, activation, changes, note: apply ? "已准备业务材料，未修改模式或业务确认" : "仅预览；增加 --apply 后新增材料" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseOptions(process.argv.slice(2), { values: ["project", "activation", "restore"], flags: ["apply"] });
  if (!args.project || !args.activation) throw new Error("必须提供 --project 和 --activation");
  if (!isMaterialActivation(args.activation)) throw new Error("未知或未开放的材料激活项");
  if (args.restore) {
    if (args.restore !== "latest") throw new Error("--restore 仅支持 latest");
    console.log(await restoreTransaction(path.resolve(args.project), `material-${args.activation}`));
  } else console.log(JSON.stringify(await prepareMaterial(args), null, 2));
}
