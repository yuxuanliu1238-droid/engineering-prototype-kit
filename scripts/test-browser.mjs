import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./project-lib.mjs";
const dependency = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(dependency ? pathToFileURL(dependency).href : "playwright");
const install = JSON.parse(
  await fs.readFile(path.join(ROOT, "dist/verification/install.json"), "utf8"),
);
const base = path.join(install.project, "prototype/dist");
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let target = path.resolve(base, "." + pathname);
    if (!target.startsWith(base + path.sep) && target !== base) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (!(await fs.stat(target)).isFile()) target = path.join(base, "index.html");
    } catch {
      target = path.join(base, "index.html");
    }
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
    };
    res.setHeader("Content-Type", types[path.extname(target)] || "application/octet-stream");
    res.end(await fs.readFile(target));
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/review`);
  assert.ok(await page.getByRole("heading", { name: "选择本轮需要验证的场景" }).isVisible());
  await page.getByRole("button", { name: "开始演示 →" }).click();
  await page.locator("nav button").filter({ hasText: "业务列表" }).click();
  assert.ok(page.url().includes("scenario=core-flow"));
  await page.locator(".table-action").first().click();
  assert.ok(await page.locator(".drawer").isVisible());
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal(await page.locator(".drawer").count(), 0);
  assert.ok((await page.locator(".focused").textContent()).includes("待处理"));
  await page.locator(".table-action").first().click();
  await page.getByRole("button", { name: "确认并完成" }).click();
  assert.ok((await page.locator(".focused").textContent()).includes("已完成"));
  await page.getByRole("button", { name: "重置场景" }).click();
  assert.ok((await page.locator(".focused").textContent()).includes("待处理"));
  await page.locator("nav button").filter({ hasText: "规则配置" }).click();
  assert.ok(await page.getByRole("button", { name: "编辑候选配置" }).isDisabled());
  assert.ok(await page.locator(".evaluation-bar").isVisible());
  await page.getByRole("button", { name: "← 返回评审中心" }).click();
  await page.getByRole("button", { name: "记录结论" }).click();
  await page.getByRole("button", { name: "已认可", exact: true }).click();
  assert.ok((await page.locator(".scenario-card").textContent()).includes("已认可"));
  await page.screenshot({ path: path.join(ROOT, "dist/verification/browser.png"), fullPage: true });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(ROOT, "dist/verification/browser.json"),
    JSON.stringify({
      result: "passed",
      scenarios: [
        "menu",
        "cancel",
        "complete",
        "reset",
        "context-persistence",
        "return-to-review",
        "disabled-placeholder",
        "review-conclusion",
      ],
      pageErrors: errors,
    }),
  );
  console.log("浏览器验收通过：菜单、取消、完成、重置、评审返回、占位控件和控制台。");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
