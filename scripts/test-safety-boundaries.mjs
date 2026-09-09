import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { safePath } from "./safe-path.mjs";
import { collectArchiveFiles, validateArchiveEntries } from "./archive-policy.mjs";
import { collectScope } from "../skills/prototype-change-retrospective/scripts/collect-scope.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-boundaries-"));
try {
  const write = async (file, content = "fixture") => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  };
  await write("prototype/src/保留 文件.js");
  await write("prototype/src/.env.local");
  await write("prototype/src/id_rsa");
  await write("prototype/src/private.pem");
  await write("prototype/src/cache/item.json");
  await fs.symlink(os.tmpdir(), path.join(root, "outside"));
  assert.throws(() => safePath(root, "outside/unowned.txt"), /符号链接/);
  assert.throws(() => safePath(root, "../unowned.txt"));
  const files = await collectArchiveFiles(root, "kit");
  assert.deepEqual(files, ["prototype/src/保留 文件.js"]);
  assert.throws(() => validateArchiveEntries(["kit/prototype/src/private.pem"], "kit", "kit"));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init");
  git("add", "prototype");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "synthetic baseline",
  );
  await fs.rename(
    path.join(root, "prototype/src/保留 文件.js"),
    path.join(root, "prototype/src/新\t文件.js"),
  );
  git("add", "-A", "prototype");
  await write(
    "registry.json",
    JSON.stringify({
      schemaVersion: 3,
      items: [
        {
          id: "CR-001",
          summary: "current schema",
          documents: ["prototype/src/保留 文件.js", "prototype/src/新\t文件.js"],
          evidence: [{ location: "prototype/src/extra.js" }],
        },
      ],
    }),
  );
  await write("prototype/src/extra.js");
  const scope = await collectScope({
    registryPath: path.join(root, "registry.json"),
    requirementId: "CR-001",
    repoRoot: root,
  });
  assert.equal(scope.title, "current schema");
  assert.deepEqual(
    scope.relatedChangedFiles,
    ["prototype/src/extra.js", "prototype/src/保留 文件.js", "prototype/src/新\t文件.js"].sort(),
  );
  console.log("安全边界通过：路径越界、归档禁入、Schema v3、暂存重命名、删除和特殊文件名。");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
