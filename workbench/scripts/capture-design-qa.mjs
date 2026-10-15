import { chromium } from "/Users/xuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text()); });
page.on("response", response => {
  if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) errors.push(`${response.status()} ${response.url()}`);
});

await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "工作台", exact: true }).click();
await page.getByRole("heading", { name: "需要你决定的事" }).waitFor();
await page.screenshot({ path: "design-qa-home.png", fullPage: true });

await page.getByRole("button", { name: "需求", exact: true }).click();
await page.getByRole("button", { name: /CR-029.*小哥累计推广排行/ }).click();
await page.getByRole("button", { name: "返回来源" }).waitFor();
await page.screenshot({ path: "design-qa-requirement.png", fullPage: true });

await page.getByRole("button", { name: "项目", exact: true }).click();
await page.getByRole("heading", { name: "你的项目" }).waitFor();
await page.screenshot({ path: "design-qa-projects.png", fullPage: true });

await page.getByRole("button", { name: "工作台", exact: true }).click();
await page.getByRole("button", { name: "＋ 新建需求", exact: true }).click();
await page.getByRole("heading", { name: "新建需求" }).waitFor();
await page.screenshot({ path: "design-qa-create.png", fullPage: true });

console.log(JSON.stringify({ result: errors.length ? "blocked" : "passed", errors }, null, 2));
await browser.close();
