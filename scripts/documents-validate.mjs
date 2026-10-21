import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./project-lib.mjs";
import { safePath } from "./safe-path.mjs";

export const DOCUMENT_BASELINE_TYPES = ["requirement", "interface"];

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const isRemoteLocator = (value) => /^[a-z][a-z0-9+.-]*:/i.test(value);
const stripFragment = (value) => value.split("#", 1)[0];
const digest = (content) => createHash("sha256").update(content).digest("hex");

function addIssue(issues, field, reason, code = "INVALID_DOCUMENT_BASELINE") {
  issues.push({ code, field, reason });
}

async function checkLocalReference(root, relativePath, field, issues, { expectedSha256 } = {}) {
  let target;
  try {
    target = safePath(root, stripFragment(relativePath));
  } catch (error) {
    addIssue(issues, field, error.message, "UNSAFE_PATH");
    return;
  }
  try {
    const content = await fs.readFile(target);
    if (expectedSha256 && digest(content) !== expectedSha256.toLowerCase()) {
      addIssue(issues, `${field}.sha256`, "本地快照摘要与记录不一致", "STALE_SNAPSHOT");
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      addIssue(issues, field, `本地引用不存在：${relativePath}`, "MISSING_REFERENCE");
      return;
    }
    addIssue(issues, field, `无法读取本地引用：${error.message}`, "UNREADABLE_REFERENCE");
  }
}

export function selectDocumentBaselineEntries(baseline, references) {
  const entries = Array.isArray(baseline?.documents) ? baseline.documents : [];
  const selected = [];
  const seen = new Set();
  for (const reference of Array.isArray(references) ? references : []) {
    for (const entry of entries.filter(
      (candidate) => candidate?.id === reference ||
        (hasText(reference) && hasText(candidate?.locator) && stripFragment(candidate.locator) === stripFragment(reference)),
    )) {
      if (!seen.has(entry.id)) {
        selected.push(entry);
        seen.add(entry.id);
      }
    }
  }
  return selected;
}

export function fingerprintDocumentBaselineEntries(entries) {
  return digest(JSON.stringify(entries || []));
}

export async function validateDocumentBaseline(baseline, { root = ROOT, source = null } = {}) {
  const issues = [];
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    addIssue(issues, source || "documentBaseline", "文档基线必须是对象");
    return { valid: false, issues, summary: null };
  }
  if (baseline.schemaVersion !== 1) {
    addIssue(issues, "schemaVersion", "document-baseline schemaVersion 必须为 1");
  }
  if (!Array.isArray(baseline.documents)) {
    addIssue(issues, "documents", "documents 必须是数组");
    return { valid: false, issues, summary: null };
  }

  const ids = new Set();
  for (const [index, entry] of baseline.documents.entries()) {
    const label = `documents[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      addIssue(issues, label, `${label} 必须是对象`);
      continue;
    }
    for (const field of ["id", "locator", "revisionLabel"]) {
      if (!hasText(entry[field])) addIssue(issues, `${label}.${field}`, `${field} 缺失`);
    }
    if (hasText(entry.id)) {
      if (ids.has(entry.id)) addIssue(issues, `${label}.id`, `文档 ID 重复：${entry.id}`);
      ids.add(entry.id);
    }
    if (!DOCUMENT_BASELINE_TYPES.includes(entry.type)) {
      addIssue(issues, `${label}.type`, "type 必须是 requirement 或 interface");
    }
    if (!hasText(entry.readAt) && !hasText(entry.reviewedAt)) {
      addIssue(issues, `${label}.readAt`, "readAt 或 reviewedAt 至少填写一项");
    }
    for (const field of ["readAt", "reviewedAt"]) {
      if (entry[field] !== undefined && (!hasText(entry[field]) || !Number.isFinite(Date.parse(entry[field])))) {
        addIssue(issues, `${label}.${field}`, `${field} 必须是有效日期时间`);
      }
    }
    if (
      !Array.isArray(entry.sections) ||
      entry.sections.length === 0 ||
      entry.sections.some((section) => !hasText(section))
    ) {
      addIssue(issues, `${label}.sections`, "sections 必须是非空字符串数组");
    }
    if (
      !Array.isArray(entry.confirmationEvidence) ||
      entry.confirmationEvidence.length === 0 ||
      entry.confirmationEvidence.some((evidence) => !hasText(evidence))
    ) {
      addIssue(
        issues,
        `${label}.confirmationEvidence`,
        "confirmationEvidence 必须是非空字符串数组",
      );
    }

    if (hasText(entry.locator) && !isRemoteLocator(entry.locator)) {
      await checkLocalReference(root, entry.locator, `${label}.locator`, issues);
    }
    for (const evidence of Array.isArray(entry.confirmationEvidence) ? entry.confirmationEvidence : []) {
      if (hasText(evidence) && !isRemoteLocator(evidence) && /^(docs|inbox|examples)\//.test(evidence)) {
        await checkLocalReference(root, evidence, `${label}.confirmationEvidence`, issues);
      }
    }
    const hasSnapshot = entry.snapshotPath !== undefined;
    const hasSnapshotDigest = entry.sha256 !== undefined;
    if (hasSnapshot !== hasSnapshotDigest) {
      addIssue(
        issues,
        `${label}.snapshotPath`,
        "snapshotPath 与 sha256 必须同时提供",
      );
    } else if (hasSnapshot) {
      if (!hasText(entry.snapshotPath)) {
        addIssue(issues, `${label}.snapshotPath`, "snapshotPath 必须是项目内相对路径");
      }
      if (!/^[a-f0-9]{64}$/i.test(entry.sha256 || "")) {
        addIssue(issues, `${label}.sha256`, "sha256 必须是 64 位十六进制摘要");
      }
      if (hasText(entry.snapshotPath) && /^[a-f0-9]{64}$/i.test(entry.sha256 || "")) {
        await checkLocalReference(root, entry.snapshotPath, `${label}.snapshotPath`, issues, {
          expectedSha256: entry.sha256,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    summary: {
      source,
      documentCount: baseline.documents.length,
      requirementCount: baseline.documents.filter((entry) => entry?.type === "requirement").length,
      interfaceCount: baseline.documents.filter((entry) => entry?.type === "interface").length,
      snapshotCount: baseline.documents.filter((entry) => hasText(entry?.snapshotPath)).length,
      scope: "offline-structure-local-reference-and-snapshot-digest",
      onlineLatestVerified: false,
    },
  };
}

export async function validateConfiguredDocuments({ root = ROOT, config } = {}) {
  const resolvedConfig =
    config || JSON.parse(await fs.readFile(safePath(root, "project.config.json"), "utf8"));
  const source = resolvedConfig.paths?.documentBaseline;
  if (!hasText(source)) {
    return {
      valid: true,
      activated: false,
      status: "skipped",
      issues: [],
      summary: {
        source: null,
        documentCount: 0,
        scope: "not-activated",
        onlineLatestVerified: false,
      },
    };
  }
  let baseline;
  try {
    baseline = JSON.parse(await fs.readFile(safePath(root, source), "utf8"));
  } catch (error) {
    return {
      valid: false,
      activated: true,
      status: "failed",
      issues: [
        {
          code: error.code === "ENOENT" ? "MISSING_BASELINE" : "UNREADABLE_BASELINE",
          field: "config.paths.documentBaseline",
          reason:
            error.code === "ENOENT"
              ? `已启用文档基线，但文件不存在：${source}`
              : `无法读取文档基线：${error.message}`,
        },
      ],
      summary: null,
    };
  }
  const result = await validateDocumentBaseline(baseline, { root, source });
  return {
    ...result,
    activated: true,
    status: result.valid ? "passed" : "failed",
    baseline,
  };
}

export async function documentsValidateCommand(root = ROOT) {
  const result = await validateConfiguredDocuments({ root });
  const output = {
    valid: result.valid,
    activated: result.activated,
    status: result.status,
    issues: result.issues,
    summary: result.summary,
    note: "仅校验离线结构、本地引用和快照摘要；不证明在线文档仍是最新版本。",
  };
  console.log(JSON.stringify(output, null, 2));
  if (!result.valid) process.exitCode = 1;
  return output;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await documentsValidateCommand(ROOT);
}
