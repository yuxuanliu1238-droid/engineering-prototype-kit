import { promises as fs } from "node:fs";

export const templateManifest = JSON.parse(
  await fs.readFile(
    new URL("../templates/business-project/template-manifest.json", import.meta.url),
    "utf8",
  ),
);

const entriesByActivation = new Map(
  templateManifest.files
    .filter((entry) => entry.inclusion === "on-demand")
    .map((entry) => [entry.activationId, entry]),
);

export function resolveActivationIds(requested = []) {
  const resolved = new Set();
  const visiting = new Set();

  function visit(activationId) {
    if (!entriesByActivation.has(activationId)) {
      throw new Error(`未知模板激活项：${activationId}`);
    }
    if (resolved.has(activationId)) return;
    if (visiting.has(activationId)) throw new Error(`模板激活依赖存在循环：${activationId}`);
    visiting.add(activationId);
    for (const dependency of templateManifest.activationDependencies?.[activationId] || []) {
      visit(dependency);
    }
    visiting.delete(activationId);
    resolved.add(activationId);
  }

  for (const activationId of requested) visit(activationId);
  return resolved;
}

export function selectTemplateFiles({
  mode,
  activations = [],
  includeAlways = true,
  includeMode = true,
} = {}) {
  if (mode !== undefined && !templateManifest.modes.includes(mode)) {
    throw new Error(`未知项目模式：${mode}`);
  }
  const active = resolveActivationIds(activations);
  return templateManifest.files.filter((entry) => {
    if (entry.inclusion === "always") return includeAlways;
    if (entry.inclusion === "on-demand") return active.has(entry.activationId);
    return includeMode && entry.inclusion === mode;
  });
}

export function selectActivationFiles(activationId) {
  return selectTemplateFiles({ activations: [activationId], includeAlways: false, includeMode: false });
}

export function isMaterialActivation(activationId) {
  return (templateManifest.materialActivations || []).includes(activationId);
}

export function templateFileForTarget(target) {
  return templateManifest.files.find((entry) => entry.target === target) || null;
}
