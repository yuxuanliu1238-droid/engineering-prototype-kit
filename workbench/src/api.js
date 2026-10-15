const API_BASE = "/api/registry";

export async function fetchRegistry() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`获取台账失败: ${res.status}`);
  return res.json();
}

export async function createItem(item) {
  const res = await fetch(`${API_BASE}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`创建需求失败: ${res.status}`);
  return res.json();
}

export async function updateItem(id, item) {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`更新需求失败: ${res.status}`);
  return res.json();
}

export async function deleteItem(id) {
  const res = await fetch(`${API_BASE}/items/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`删除需求失败: ${res.status}`);
  return res.json();
}

export function generateNextId(items) {
  const maxNum = items.reduce((max, item) => {
    const match = item.id?.match(/^CR-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `CR-${String(maxNum + 1).padStart(3, "0")}`;
}

export function makeNewItem(id, summary, originalRequest, source = "工作台录入") {
  const now = new Date().toISOString();
  return {
    id,
    summary,
    originalRequest,
    source,
    proposedAt: now,
    currentStageId: "recorded",
    executionState: "locked",
    aiPolicy: "unassessed",
    pageIds: [],
    actionIds: [],
    stateIds: [],
    documents: [],
    executionScope: {
      objective: summary,
      included: [],
      excluded: [],
      deferred: [],
    },
    riskAssessment: null,
    activities: [],
    readinessChecklist: [
      { id: "goal-clear", status: "not-assessed", evidence: [] },
      { id: "scope-clear", status: "not-assessed", evidence: [] },
      { id: "acceptance-testable", status: "not-assessed", evidence: [] },
      { id: "dependencies-clear", status: "not-assessed", evidence: [] },
      { id: "rules-confirmed", status: "not-assessed", evidence: [] },
      { id: "authorization-confirmed", status: "not-assessed", evidence: [] },
      { id: "risk-reviewed", status: "not-assessed", evidence: [] },
    ],
    waitingReason: null,
    pauseReason: null,
    cancellationReason: null,
    evidence: [],
    artifacts: [],
    reviewConfirmation: null,
  };
}

export const STAGE_LABELS = {
  recorded: "已记录",
  "analysis-confirmation": "业务方案确认",
  implementation: "原型制作中",
  "awaiting-review": "待确认原型",
  completed: "已完成",
};

export const EXECUTION_STATE_LABELS = {
  locked: "已锁定",
  ready: "就绪",
  "in-progress": "进行中",
  "waiting-human": "等待确认",
  paused: "已暂停",
  completed: "已完成",
  cancelled: "已取消",
};

export const AI_POLICY_LABELS = {
  unassessed: "未评估",
  "planning-only": "仅分析",
  "execution-allowed": "允许制作原型",
  "human-only": "仅人工",
};

export const READINESS_LABELS = {
  "goal-clear": "目标和背景",
  "scope-clear": "范围和非目标",
  "acceptance-testable": "可观察验收标准",
  "dependencies-clear": "依赖",
  "rules-confirmed": "业务规则",
  "authorization-confirmed": "原型制作授权",
  "risk-reviewed": "风险评估",
};

export function getReadinessProgress(item) {
  const checklist = item.readinessChecklist || [];
  const met = checklist.filter((c) => c.status === "met").length;
  return { met, total: checklist.length };
}

export function deriveNextAction(item) {
  if (item.executionState === "waiting-human") {
    return item.waitingReason?.question || "回答当前唯一问题";
  }
  if (item.executionState === "paused") {
    return item.pauseReason?.resumeWhen || "确认恢复条件";
  }
  if (item.currentStageId === "awaiting-review") {
    return "预览原型并确认本轮结果";
  }
  if (item.aiPolicy === "unassessed") {
    return "让 AI 分析需求，再确认业务方案";
  }
  const missing = (item.readinessChecklist || []).find(
    (c) => c.status === "not-assessed" || c.status === "not-met"
  );
  if (missing) {
    return `补充或确认${READINESS_LABELS[missing.id] || missing.id}`;
  }
  const nextActivity = (item.activities || []).find(
    (a) => !["已完成", "已跳过"].includes(a.status)
  );
  if (nextActivity) {
    return `继续处理${nextActivity.id}`;
  }
  return "确认本轮原型结果";
}
