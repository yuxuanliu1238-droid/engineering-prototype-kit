import { useState } from "react";
import { updateItem, EXECUTION_STATE_LABELS } from "../api.js";

const WAITING_REASON_LABELS = {
  "missing-information": "信息缺失",
  "rule-ambiguity": "规则歧义",
  "authorization-required": "需要授权",
  "review-required": "需要评审",
  "validation-failed": "校验未通过",
  "risk-exceeded": "风险超标",
  "dependency-blocked": "依赖阻塞",
};

export default function TodoList({ items, onConfirmed }) {
  const waitingItems = (items || []).filter((item) => item.executionState === "waiting-human");
  const [confirmText, setConfirmText] = useState({});
  const [submitting, setSubmitting] = useState(null);

  if (waitingItems.length === 0) {
    return (
      <div className="todo-empty">
        <h3>没有需要你处理的事项</h3>
        <p>所有需求都在 AI 处理中，或已完成。新的待确认事项出现时会显示在这里。</p>
      </div>
    );
  }

  async function handleConfirm(item) {
    const text = (confirmText[item.id] || "").trim();
    if (!text) return;

    setSubmitting(item.id);
    try {
      const updated = { ...item };
      const now = new Date().toISOString();

      updated.executionState = "ready";
      updated.waitingReason = null;

      const evidenceId = `ev-${item.id}-${Date.now()}`;
      updated.evidence = [
        ...(updated.evidence || []),
        {
          id: evidenceId,
          sourceType: "review",
          location: "工作台确认",
          originalClaim: text,
          aiInterpretation: text,
          scope: item.id,
          confirmationStatus: "confirmed",
          occurredAt: now,
          confirmedBy: "产品经理",
          confirmedAt: now,
        },
      ];

      if (updated.riskAssessment && !updated.riskAssessment.confirmedBy) {
        updated.riskAssessment = {
          ...updated.riskAssessment,
          confirmedBy: "产品经理",
          confirmedAt: now,
        };
      }

      await updateItem(item.id, updated);
      setConfirmText((prev) => ({ ...prev, [item.id]: "" }));
      onConfirmed?.(updated);
    } catch (err) {
      alert(`确认失败: ${err.message}`);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="todo-list">
      {waitingItems.map((item) => {
        const reason = item.waitingReason || {};
        const reasonLabel = WAITING_REASON_LABELS[reason.code] || reason.code;
        return (
          <div className="todo-item" key={item.id}>
            <div className="todo-item-header">
              <div>
                <span className="id">{item.id}</span>
                <span className="summary">{item.summary}</span>
              </div>
              <span className="tag tag-waiting">{reasonLabel}</span>
            </div>

            <div className="todo-details">
              <div className="todo-detail">
                <div className="label">需要你确认的问题</div>
                <div className="value">{reason.question || "—"}</div>
              </div>
              <div className="todo-detail">
                <div className="label">请求确认方</div>
                <div className="value">{reason.requestedFrom || "—"}</div>
              </div>
              <div className="todo-detail">
                <div className="label">影响</div>
                <div className="value">{reason.impact || "—"}</div>
              </div>
              <div className="todo-detail">
                <div className="label">确认后恢复</div>
                <div className="value">{reason.resumeWhen || "—"}</div>
              </div>
            </div>

            <div className="todo-actions">
              <input
                className="confirm-input"
                type="text"
                placeholder="输入你的确认意见或决策..."
                value={confirmText[item.id] || ""}
                onChange={(e) => setConfirmText((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleConfirm(item)}
                disabled={submitting === item.id || !(confirmText[item.id] || "").trim()}
              >
                {submitting === item.id ? "确认中..." : "确认并继续"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
