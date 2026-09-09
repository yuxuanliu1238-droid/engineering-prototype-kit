import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyTransaction, restoreTransaction, previewGuard } from "./transaction-lib.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-tx-"));
try {
  await fs.writeFile(path.join(root, "a"), "before");
  for (const failAt of ["prepared", "backup-verified", "after-writes", "after-verify"]) {
    await assert.rejects(
      applyTransaction(root, failAt, new Map([["a", Buffer.from("after")]]), { failAt }),
    );
    if (["prepared", "backup-verified"].includes(failAt)) await restoreTransaction(root, failAt);
    assert.equal(await fs.readFile(path.join(root, "a"), "utf8"), "before");
  }
  for (const failAfter of [1, 2]) {
    await assert.rejects(
      applyTransaction(
        root,
        "test",
        new Map([
          ["a", Buffer.from("after")],
          ["b", Buffer.from("new")],
        ]),
        { failAfter },
      ),
    );
    assert.equal(await fs.readFile(path.join(root, "a"), "utf8"), "before");
    await assert.rejects(fs.access(path.join(root, "b")));
  }
  await applyTransaction(root, "test", new Map([["a", Buffer.from("after")]]));
  await fs.writeFile(path.join(root, "a"), "user change");
  await assert.rejects(restoreTransaction(root, "test"), /后续修改/);
  await fs.writeFile(path.join(root, "a"), "after");
  await restoreTransaction(root, "test");
  assert.equal(await fs.readFile(path.join(root, "a"), "utf8"), "before");
  await previewGuard(root, "preview", ["a"], false);
  await fs.writeFile(path.join(root, "a"), "preview changed");
  await assert.rejects(previewGuard(root, "preview", ["a"], true), /预览后/);
  await fs.writeFile(path.join(root, "a"), "before");
  const corrupt = await applyTransaction(root, "corrupt", new Map([["a", Buffer.from("after")]]));
  await fs.writeFile(path.join(root, corrupt, "files/a"), "corrupted");
  await assert.rejects(restoreTransaction(root, "corrupt"), /备份摘要/);
  assert.equal(await fs.readFile(path.join(root, "a"), "utf8"), "after");
  await fs.writeFile(
    path.join(root, ".prototype-kit/operation.lock"),
    JSON.stringify({ pid: process.pid }),
  );
  await assert.rejects(
    applyTransaction(root, "concurrent", new Map([["a", Buffer.from("unsafe")]])),
    /并发/,
  );
  await assert.rejects(restoreTransaction(root, "corrupt"), /仍在运行/);
  await fs.rm(path.join(root, ".prototype-kit/operation.lock"));
  console.log("事务测试：故障回滚、后续修改冲突和正常恢复通过。");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
