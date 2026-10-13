import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ROOT } from "./project-lib.mjs";
import { safePath } from "./safe-path.mjs";
import { templateManifest } from "./runtime-manifest.mjs";
import { applyTransaction, previewGuard } from "./transaction-lib.mjs";

const SUPPORTED = {
  "domain-evidence": "domainEvidence",
  "delivery-governance": "deliveryGovernance",
};

const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, "utf8"));
}

export async function buildOptionalMaterialPlan(projectRoot, activationId) {
  const pathKey = SUPPORTED[activationId];
  if (!pathKey) {
    throw new Error(
      `当前命令只支持按需启用：${Object.keys(SUPPORTED).join("、")}`,
    );
  }
  const entry = templateManifest.files.find((item) => item.activationId === activationId);
  if (!entry || entry.inclusion !== "on-demand") {
    throw new Error(`模板清单不存在按需能力：${activationId}`);
  }

  const configPath = safePath(projectRoot, "project.config.json");
  const manifestPath = safePath(projectRoot, ".prototype-kit/manifest.json");
  const config = await readJson(configPath);
  const projectManifest = await readJson(manifestPath);
  if (config.instanceKind !== "business-project") throw new Error("目标不是 Kit 业务项目");

  const targetPath = safePath(projectRoot, entry.target);
  try {
    await fs.access(targetPath);
    throw new Error(`按需材料已存在，停止以避免覆盖：${entry.target}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const material = await fs.readFile(
    path.join(ROOT, "templates/business-project", entry.source),
  );
  const nextConfig = {
    ...config,
    paths: { ...(config.paths || {}), [pathKey]: entry.target },
  };
  const configContent = json(nextConfig);
  const nextFiles = (projectManifest.files || []).filter(
    (item) => item.path !== entry.target && item.path !== "project.config.json",
  );
  nextFiles.push(
    {
      path: entry.target,
      ownership: entry.ownership,
      sha256: sha256(material),
    },
    {
      path: "project.config.json",
      ownership: "kit-managed",
      sha256: sha256(configContent),
    },
  );
  const nextManifest = {
    ...projectManifest,
    files: nextFiles.sort((left, right) => left.path.localeCompare(right.path)),
  };
  return {
    activationId,
    target: entry.target,
    writes: new Map([
      [entry.target, material],
      ["project.config.json", configContent],
      [".prototype-kit/manifest.json", json(nextManifest)],
    ]),
  };
}

export async function activateOptionalMaterial(projectRoot, activationId, { apply = false } = {}) {
  const plan = await buildOptionalMaterialPlan(projectRoot, activationId);
  const files = [...plan.writes.keys()];
  const kind = `activate-${activationId}`;
  const expected = await previewGuard(projectRoot, kind, files, apply);
  if (!apply) return { ...plan, applied: false };
  const backup = await applyTransaction(projectRoot, kind, plan.writes, {
    expected,
    verify: async () => {
      await readJson(safePath(projectRoot, plan.target));
      const config = await readJson(safePath(projectRoot, "project.config.json"));
      if (config.paths?.[SUPPORTED[activationId]] !== plan.target) {
        throw new Error("按需材料路径未正确写入项目配置");
      }
    },
  });
  return { ...plan, applied: true, backup };
}
