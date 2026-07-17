import { promises as fs } from "node:fs";
import path from "node:path";
import { printResult, ROOT } from "./project-lib.mjs";
import { PAGE_CONTRACTS } from "../prototype/src/contracts/index.js";

const errors = [];
const prototypeRoot = path.join(ROOT, "prototype");
const htmlPath = path.join(prototypeRoot, "index.html");
const html = await fs.readFile(htmlPath, "utf8");
const localLinks = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !/^(?:https?:|#|mailto:|tel:)/.test(value));

for (const link of localLinks) {
  const clean = link.split(/[?#]/)[0].replace(/^\//, "");
  if (!clean) continue;
  try {
    await fs.access(path.join(prototypeRoot, clean));
  } catch {
    try {
      await fs.access(path.join(prototypeRoot, "public", clean));
    } catch {
      errors.push(`prototype/index.html 引用不存在：${link}`);
    }
  }
}

for (const contract of PAGE_CONTRACTS) {
  try {
    await fs.access(path.join(prototypeRoot, contract.preview.entry));
  } catch {
    errors.push(`${contract.pageId} 的预览入口不存在：${contract.preview.entry}`);
  }
}

printResult("原型链接校验", errors, `${localLinks.length} 个本地链接和 ${PAGE_CONTRACTS.length} 个契约入口`);
