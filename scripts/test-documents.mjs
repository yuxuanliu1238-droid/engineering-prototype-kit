import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateDocumentBaseline, validateConfiguredDocuments } from "./documents-validate.mjs";
import { createTaskContext, verifyTaskContext } from "./task-context.mjs";
import { makeEmptyRegistry } from "./workflow-v3-lib.mjs";
import { EXPECTED_ARTIFACT_TYPES } from "./workflow/model.mjs";
import { ROOT } from "./project-lib.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-documents-"));
const write = (file, value) => fs.writeFile(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value));
try {
  const example = JSON.parse(await fs.readFile(path.join(ROOT, "examples/document-review/baseline.json"), "utf8"));
  assert.equal((await validateDocumentBaseline(example, { root: ROOT })).valid, true);
  await fs.mkdir(path.join(root, "docs"));
  await write("AGENTS.md", "fixture rules");
  await write("snapshot.md", "synthetic snapshot");
  const sha256 = createHash("sha256").update("synthetic snapshot").digest("hex");
  const doc = { id: "DOC-REQ", type: "requirement", locator: "https://example.invalid/requirements",
    revisionLabel: "revision-1", readAt: "2026-10-16T10:00:00+08:00", sections: ["5.1"],
    confirmationEvidence: ["synthetic adoption only"], snapshotPath: "snapshot.md", sha256 };
  const baseline = { schemaVersion: 1, documents: [doc, { ...doc, id: "DOC-UNRELATED", locator: "https://example.invalid/unrelated" }] };
  assert.equal((await validateDocumentBaseline(baseline, { root })).valid, true);
  assert.equal((await validateConfiguredDocuments({ root, config: {} })).activated, false);
  for (const change of [
    { type: "other" }, { readAt: "invalid" }, { sections: [] }, { confirmationEvidence: [] },
    { snapshotPath: "missing.md" }, { sha256: "0".repeat(64) }, { snapshotPath: "../outside.md" },
    { locator: "missing.md" }, { confirmationEvidence: ["docs/missing.md"] },
  ]) assert.equal((await validateDocumentBaseline({ schemaVersion: 1, documents: [{ ...doc, ...change }] }, { root })).valid, false, JSON.stringify(change));
  assert.equal((await validateDocumentBaseline({ schemaVersion: 1, documents: [doc, doc] }, { root })).valid, false);
  await write("baseline.json", baseline);
  const config = { paths: { requirements: "registry.json", documentBaseline: "baseline.json" } };
  await write("project.config.json", config);
  await write("project-status.json", { currentMode: "continuous-iteration" });
  const registry = makeEmptyRegistry();
  registry.items = [{ id: "CR-001", documents: ["DOC-REQ"], executionState: "locked", aiPolicy: "unassessed",
    executionScope: { objective: "synthetic review", excluded: ["NO_IMPLEMENTATION"] }, acceptanceCriteria: ["visible"], openQuestions: [] }];
  await write("registry.json", registry);
  const pack = await createTaskContext({ root, cr: "CR-001" });
  assert.deepEqual(pack.documentBaselineSelection.entries.map((entry) => entry.id), ["DOC-REQ"]);
  assert.ok(!JSON.stringify(pack).includes("DOC-UNRELATED"));
  assert.ok(pack.coveredFiles.some((file) => file.path === "snapshot.md"));
  assert.equal(pack.allowedAction, "read-only");
  assert.equal((await verifyTaskContext(pack, { root })).status, "fresh");
  baseline.documents[1].revisionLabel = "unrelated-2";
  await write("baseline.json", baseline);
  assert.equal((await verifyTaskContext(pack, { root })).status, "fresh");
  baseline.documents[0].revisionLabel = "revision-2";
  await write("baseline.json", baseline);
  assert.equal((await verifyTaskContext(pack, { root })).status, "stale");
  const currentPack = await createTaskContext({ root, cr: "CR-001" });
  await write("snapshot.md", "changed");
  assert.equal((await verifyTaskContext(currentPack, { root })).status, "stale");
  assert.equal((await validateConfiguredDocuments({ root, config })).valid, false);
  registry.items[0].documents = [`${doc.locator}#section`];
  await write("registry.json", registry);
  assert.equal((await createTaskContext({ root, cr: "CR-001" })).documentBaselineSelection.entries.length, 1);
  assert.ok(EXPECTED_ARTIFACT_TYPES.includes("requirement-document"));
  assert.ok(EXPECTED_ARTIFACT_TYPES.includes("interface-document"));
  console.log("文档基线：结构、引用、摘要、任务最小展开、相关修订与快照过期、类型兼容通过。");
} finally { await fs.rm(root, { recursive: true, force: true }); }
