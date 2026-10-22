import path from "node:path";
import { promises as fs } from "node:fs";
import { safePath } from "./safe-path.mjs";
import { validateConfiguredDocuments } from "./documents-validate.mjs";

export async function resolveArchiveConfig(root, kind, config = {}) {
  if (kind !== "business" || !config.paths?.documentBaseline) return config;
  const result = await validateConfiguredDocuments({ root, config });
  if (!result.valid) throw new Error(`文档基线无效，不能打包：${result.issues.map((issue) => issue.reason).join("；")}`);
  const files = new Set();
  for (const entry of result.baseline.documents) {
    for (const reference of [entry.locator, entry.snapshotPath, ...entry.confirmationEvidence.filter((item) => /^(docs|inbox|examples)\//.test(item))]) {
      if (!reference || /^[a-z][a-z0-9+.-]*:/i.test(reference)) continue;
      const file = reference.split("#")[0];
      safePath(root, file);
      if (forbiddenArchivePath(file)) throw new Error(`文档交付引用不在安全文件范围：${file}`);
      files.add(file);
    }
  }
  return { ...config, documentEvidenceFiles: [...files] };
}
const fixed = new Set([
  "AGENTS.md",
  "README.md",
  "START-HERE.md",
  "LICENSE",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "project.config.json",
  "project-status.json",
]);
export function forbiddenArchivePath(file) {
  const segments = file.split("/");
  return (
    file.includes("\\") ||
    path.isAbsolute(file) ||
    segments.some(
      (s) =>
        s === ".." ||
        s === "" ||
        /^(\.env(?:\.|$)|\.git$|node_modules$|\.cache$|\.DS_Store$|id_rsa$|id_ed25519$)/i.test(s) ||
        /\.(?:pem|key|p12|pfx|log|tmp|bak)$/i.test(s) ||
        /^(?:cache|backups|\.tmp.*)$/.test(s),
    )
  );
}
export function allowedArchivePath(file, kind, config = {}) {
  if (forbiddenArchivePath(file)) return false;
  if (fixed.has(file)) return true;
  if (/^prototype\/(?:src|public|dist)\//.test(file))
    return /\.(?:m?js|jsx|ts|tsx|css|json|html|svg|png|jpg|webp|woff2?)$/.test(file);
  if (/^prototype\/(?:index\.html|package\.json|vite\.config\.mjs)$/.test(file)) return true;
  if (kind === "kit") {
    if (file === "scripts/workflow-lib.mjs") return false; // preserved locally as a compatibility entry
    return (
      /^(?:scripts|skills|templates|examples)\//.test(file) &&
      /\.(?:m?js|jsx|css|json|md|ya?ml|html)$/.test(file)
    );
  }
  const documents = new Set([
    ...(config.documentEvidenceFiles || []),
    "docs/business-baseline.md",
    "docs/demo-blueprint.md",
    "docs/review/review-confirmation.md",
    "docs/decisions/decisions.md",
    "docs/requirements/README.md",
    "docs/page-guides/README.md",
    "docs/development/README.md",
    ...Object.values(config.paths || {}).filter(
      (v) => typeof v === "string" && /\.(?:md|json)$/.test(v),
    ),
  ]);
  return documents.has(file);
}
export async function collectArchiveFiles(root, kind, config = {}) {
  const output = [];
  async function visit(relative = ".") {
    for (const entry of await fs.readdir(safePath(root, relative), { withFileTypes: true })) {
      const file = relative === "." ? entry.name : `${relative}/${entry.name}`;
      if (forbiddenArchivePath(file)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (
          relative === "." &&
          ![
            "prototype",
            ...(kind === "kit" ? ["scripts", "skills", "templates", "examples"] : ["docs"]),
          ].includes(entry.name)
        )
          continue;
        if (
          file === "docs/design" ||
          file.startsWith("docs/review/check-reports") ||
          (file === "prototype/dist" && kind !== "kit" && config.excludeBuild)
        )
          continue;
        await visit(file);
      } else if (entry.isFile() && allowedArchivePath(file, kind, config)) output.push(file);
    }
  }
  await visit();
  if (kind === "business") {
    for (const file of config.documentEvidenceFiles || []) {
      if (!allowedArchivePath(file, kind, config)) throw new Error(`文档引用不在交付清单：${file}`);
      if (!(await fs.stat(safePath(root, file))).isFile()) throw new Error(`文档交付引用不是文件：${file}`);
      if (!output.includes(file)) output.push(file);
    }
  }
  return output.sort();
}
export function validateArchiveEntries(entries, prefix, kind, config = {}) {
  for (const file of entries)
    if (
      !file.startsWith(`${prefix}/`) ||
      !allowedArchivePath(file.slice(prefix.length + 1), kind, config)
    )
      throw new Error(`归档条目不在交付清单中：${file}`);
}
