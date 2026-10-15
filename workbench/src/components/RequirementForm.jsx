import { useState } from "react";
import { createItem, generateNextId, makeNewItem } from "../api.js";

export default function RequirementForm({ registry, onCreated }) {
  const [summary, setSummary] = useState("");
  const [originalRequest, setOriginalRequest] = useState("");
  const [source, setSource] = useState("工作台录入");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const canSubmit = summary.trim() && originalRequest.trim() && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const id = generateNextId(registry.items || []);
      const item = makeNewItem(id, summary.trim(), originalRequest.trim(), source.trim() || "工作台录入");
      await createItem(item);
      setSuccess(`需求 ${id} 已录入，进入「已记录」阶段`);
      setSummary("");
      setOriginalRequest("");
      setSource("工作台录入");
      onCreated?.(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-card">
      <h2>录入新需求</h2>

      {success && <div className="form-success">{success}</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="summary">需求摘要 *</label>
          <input
            id="summary"
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="一句话描述这条需求要解决什么问题"
            maxLength={200}
          />
          <div className="hint">将作为执行范围的 objective，建议简洁明确</div>
        </div>

        <div className="form-group">
          <label htmlFor="originalRequest">原始请求 *</label>
          <textarea
            id="originalRequest"
            value={originalRequest}
            onChange={(e) => setOriginalRequest(e.target.value)}
            placeholder="完整记录原始需求描述、背景、提出人、相关材料等"
          />
          <div className="hint">保留原始表述，AI 分析时会基于此做事实与假设分离</div>
        </div>

        <div className="form-group">
          <label htmlFor="source">来源</label>
          <input
            id="source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="如：客户会议、产品评审、内部讨论"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? "录入中..." : "录入需求"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSummary("");
              setOriginalRequest("");
              setSource("工作台录入");
              setSuccess(null);
              setError(null);
            }}
          >
            清空
          </button>
        </div>
      </form>
    </div>
  );
}
