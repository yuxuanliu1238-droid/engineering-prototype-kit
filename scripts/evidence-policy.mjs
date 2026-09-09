import { promises as fs } from "node:fs";
import { safePath } from "./safe-path.mjs";
const array = (value) => (Array.isArray(value) ? value : []);
const text = (value) => typeof value === "string" && !!value.trim();
const date = (value) => text(value) && Number.isFinite(Date.parse(value));
export function validateEvidencePolicy(item) {
  const errors = [];
  const evidence = new Map(
    array(item.evidence)
      .filter(Boolean)
      .map((e) => [e.id, e]),
  );
  const criteria = array(item.acceptanceCriteria);
  const ac = new Set(criteria.filter(Boolean).map((c) => c.id));
  if (
    !criteria.length ||
    criteria.some((c) => !c || !text(c.id) || !text(c.text)) ||
    ac.size !== criteria.length
  )
    errors.push(`${item.id} 缺少唯一、结构化验收项 acceptanceCriteria[{id,text}]`);
  const resolve = (id, label) => {
    const e = evidence.get(id);
    if (
      !e ||
      e.confirmationStatus !== "confirmed" ||
      !text(e.location) ||
      /^(generated:|test:)/.test(e.location) ||
      !text(e.confirmedBy) ||
      !date(e.confirmedAt)
    )
      errors.push(`${label} 证据未确认或引用不存在：${id}`);
  };
  for (const check of array(item.readinessChecklist))
    if (check?.status === "met") for (const id of array(check.evidence)) resolve(id, check.id);
  for (const activity of array(item.activities)) {
    if (activity?.status === "已完成")
      for (const id of array(activity.evidence)) resolve(id, activity.id);
    if (activity?.status === "已跳过") resolve(activity.skipConfirmationRef, activity.id);
  }
  const gates = new Set(["product-review", ...array(item.readinessChecklist).map((c) => c?.id)]);
  for (const a of array(item.artifacts))
    for (const id of array(a?.supports))
      if (!ac.has(id) && !gates.has(id)) errors.push(`${item.id} 未知验收或门禁引用：${id}`);
  if (item.currentStageId === "completed") {
    const review = item.reviewConfirmation;
    if (!array(review?.evidenceIds).length || !date(review?.confirmedAt))
      errors.push(`${item.id} 完成缺少有效人工确认证据或日期`);
    for (const id of array(review?.evidenceIds)) resolve(id, "产品评审");
    const supported = new Set(
      array(item.artifacts)
        .filter((a) => a?.type === "test-report" || a?.type === "review-report")
        .flatMap((a) => array(a.supports)),
    );
    for (const id of ac)
      if (!supported.has(id)) errors.push(`${item.id} 验收项没有报告支撑：${id}`);
  }
  return errors;
}
export async function verifyEvidenceFiles(item, root) {
  const errors = [];
  for (const entry of [...array(item.evidence), ...array(item.artifacts)]) {
    const location = entry?.location;
    if (!text(location)) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(location)) {
      if (
        !entry.verification ||
        entry.verification.method !== "manual" ||
        !text(entry.verification.confirmedBy) ||
        !date(entry.verification.confirmedAt)
      )
        errors.push(`外部证据待人工核验：${location.split(":")[0]} 引用`);
      continue;
    }
    try {
      const target = safePath(root, location.split("#")[0]);
      if (!(await fs.stat(target)).isFile()) throw new Error("不是文件");
      if (entry.type === "review-report") {
        const content = await fs.readFile(target, "utf8");
        if (
          !content.trim() ||
          entry.confirmationStatus !== "confirmed" ||
          !text(entry.confirmedBy) ||
          !date(entry.confirmedAt)
        )
          errors.push(`人工评审报告尚未确认或内容为空：${location}`);
      }
      if (entry.type === "test-report") {
        const report = JSON.parse(await fs.readFile(target, "utf8"));
        const { evaluateCheckReport } = await import("./check-runner.mjs");
        const result = await evaluateCheckReport(report, { root });
        if (!result.valid) errors.push(`检查报告不能用于交付：${location}（${result.reason}）`);
      }
    } catch (error) {
      errors.push(`证据不可用：${location}（${error.message}）`);
    }
  }
  return errors;
}
