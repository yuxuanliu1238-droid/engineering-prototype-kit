import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { safePath } from "./safe-path.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const json = (x) => Buffer.from(JSON.stringify(x, null, 2) + "\n");
async function contents(root, file) {
  try {
    return await fs.readFile(safePath(root, file));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export async function snapshotFiles(root, files) {
  const result = {};
  for (const file of files) {
    const b = await contents(root, file);
    result[file] = b === null ? null : hash(b);
  }
  return result;
}
async function atomicWrite(root, file, buffer) {
  const target = safePath(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = safePath(root, `${file}.kit-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, buffer, { flag: "wx" });
    await fs.rename(temporary, safePath(root, file));
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
async function lock(root, recovery = false) {
  const file = safePath(root, ".prototype-kit/operation.lock");
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const handle = await fs.open(file, "wx");
    await handle.writeFile(JSON.stringify({ pid: process.pid }));
    await handle.close();
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    if (!recovery) throw new Error("项目有并发或中断操作；检查后使用恢复入口");
    let owner;
    try {
      owner = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      throw new Error("操作锁损坏，需人工核对");
    }
    try {
      process.kill(owner.pid, 0);
      throw new Error("项目操作仍在运行");
    } catch (err) {
      if (err.code !== "ESRCH") throw err;
    }
    await fs.rm(file);
    return lock(root, false);
  }
  return () => fs.rm(file, { force: true });
}
async function pending(root) {
  const dir = safePath(root, ".prototype-kit/backups");
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  for (const name of names) {
    const data = await contents(root, `.prototype-kit/backups/${name}/backup-manifest.json`);
    if (!data) continue;
    const journal = JSON.parse(data);
    if (
      journal.transactionVersion === 1 &&
      ["prepared", "writing", "restoring", "recovery-required"].includes(journal.phase)
    )
      return name;
  }
  return null;
}
export async function previewGuard(root, kind, files, apply) {
  const file = `.prototype-kit/previews/${kind}.json`;
  const expected = await snapshotFiles(root, files);
  const previous = await contents(root, file);
  if (apply && previous) {
    const saved = JSON.parse(previous);
    const now = await snapshotFiles(root, Object.keys(saved));
    if (JSON.stringify(now) !== JSON.stringify(saved))
      throw new Error("预览后文件已变化，请重新预览");
  }
  if (!apply) await atomicWrite(root, file, json(expected));
  return expected;
}
async function restoreJournal(root, relative, journal, { rollback = false } = {}) {
  // Preflight every backup before touching any destination.
  const originals = new Map();
  for (const entry of journal.files) {
    const b = entry.existed ? await contents(root, `${relative}/files/${entry.path}`) : null;
    if (entry.existed && (!b || hash(b) !== entry.sha256))
      throw new Error(`备份摘要不一致：${entry.path}`);
    originals.set(entry.path, b);
    const current = await contents(root, entry.path);
    const observed = current === null ? null : hash(current);
    const allowed = rollback ? [entry.sha256, entry.afterSha256] : [entry.afterSha256];
    if (!allowed.includes(observed)) throw new Error(`存在后续修改，恢复被阻断：${entry.path}`);
  }
  journal.phase = "restoring";
  await atomicWrite(root, `${relative}/backup-manifest.json`, json(journal));
  for (const [file, b] of originals) {
    if (b === null) await fs.rm(safePath(root, file), { force: true });
    else await atomicWrite(root, file, b);
  }
  journal.phase = "restored";
  await atomicWrite(root, `${relative}/backup-manifest.json`, json(journal));
}
export async function applyTransaction(
  root,
  kind,
  writes,
  { expected = {}, verify, failAfter = 0, failAt = null } = {},
) {
  const inject = (phase) => {
    if (failAt === phase) throw new Error(`合成阶段故障：${phase}`);
  };
  const release = await lock(root);
  let journal, relative;
  try {
    const interrupted = await pending(root);
    if (interrupted) throw new Error(`存在未完成事务：${interrupted}，请先恢复`);
    const actual = await snapshotFiles(root, Object.keys(expected));
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error("预检后文件已变化，应用被阻断");
    relative = `.prototype-kit/backups/${kind}-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`;
    journal = {
      transactionVersion: 1,
      kind,
      createdAt: new Date().toISOString(),
      phase: "prepared",
      files: [],
    };
    for (const [file, content] of writes) {
      const before = await contents(root, file);
      if (before !== null) await atomicWrite(root, `${relative}/files/${file}`, before);
      await atomicWrite(root, `${relative}/staged/${file}`, content);
      journal.files.push({
        path: file,
        existed: before !== null,
        sha256: before === null ? null : hash(before),
        afterSha256: hash(content),
      });
    }
    await atomicWrite(root, `${relative}/backup-manifest.json`, json(journal));
    inject("prepared");
    for (const entry of journal.files) {
      const staged = await contents(root, `${relative}/staged/${entry.path}`);
      if (!staged || hash(staged) !== entry.afterSha256) throw new Error("暂存摘要不一致");
      if (
        entry.existed &&
        hash(await contents(root, `${relative}/files/${entry.path}`)) !== entry.sha256
      )
        throw new Error("备份摘要不一致");
    }
    inject("backup-verified");
    journal.phase = "writing";
    await atomicWrite(root, `${relative}/backup-manifest.json`, json(journal));
    let count = 0;
    for (const entry of journal.files) {
      const current = await contents(root, entry.path);
      if ((current === null ? null : hash(current)) !== entry.sha256)
        throw new Error(`写入前文件变化：${entry.path}`);
      await atomicWrite(root, entry.path, await contents(root, `${relative}/staged/${entry.path}`));
      if (++count === failAfter) throw new Error("合成故障注入");
    }
    inject("after-writes");
    if (verify) await verify();
    inject("after-verify");
    journal.phase = "committed";
    await atomicWrite(root, `${relative}/backup-manifest.json`, json(journal));
    return relative;
  } catch (error) {
    if (journal?.phase === "writing") {
      try {
        await restoreJournal(root, relative, journal, { rollback: true });
      } catch (rollbackError) {
        journal.phase = "recovery-required";
        await atomicWrite(root, `${relative}/backup-manifest.json`, json(journal));
        throw new Error(`${error.message}；恢复需处理：${rollbackError.message}`);
      }
    }
    throw error;
  } finally {
    await release();
  }
}
export async function restoreTransaction(root, kind) {
  const release = await lock(root, true);
  try {
    const dir = safePath(root, ".prototype-kit/backups");
    let names = [];
    try {
      names = (await fs.readdir(dir))
        .filter((n) => n.startsWith(kind + "-"))
        .sort()
        .reverse();
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    for (const name of names) {
      const relative = `.prototype-kit/backups/${name}`;
      const data = await contents(root, `${relative}/backup-manifest.json`);
      if (!data) continue;
      const journal = JSON.parse(data);
      if (journal.phase === "restored") continue;
      if (journal.transactionVersion !== 1) throw new Error("旧备份无写后摘要，需人工核对后恢复");
      await restoreJournal(root, relative, journal, { rollback: journal.phase !== "committed" });
      return relative;
    }
    throw new Error("没有可恢复的事务备份");
  } finally {
    await release();
  }
}
