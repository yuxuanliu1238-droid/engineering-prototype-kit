import {
  STAGE_LABELS,
  EXECUTION_STATE_LABELS,
  AI_POLICY_LABELS,
  getReadinessProgress,
  deriveNextAction,
} from "../api.js";

const STAGE_ORDER = ["recorded", "analysis-confirmation", "implementation", "awaiting-review", "completed"];

export default function KanbanBoard({ items, onCardClick }) {
  const columns = STAGE_ORDER.map((stageId) => ({
    id: stageId,
    label: STAGE_LABELS[stageId],
    items: (items || []).filter((item) => item.currentStageId === stageId),
  }));

  return (
    <div className="kanban">
      {columns.map((col) => (
        <div className="kanban-column" key={col.id}>
          <div className="kanban-column-header">
            <h3>{col.label}</h3>
            <span className="kanban-count">{col.items.length}</span>
          </div>
          <div className="kanban-cards">
            {col.items.length === 0 && (
              <div style={{ color: "#9ca3af", fontSize: "13px", padding: "8px 4px" }}>暂无</div>
            )}
            {col.items.map((item) => {
              const { met, total } = getReadinessProgress(item);
              const progressPct = total > 0 ? (met / total) * 100 : 0;
              const stateClass = `state-${item.executionState}`;
              return (
                <div
                  className={`kanban-card ${stateClass}`}
                  key={item.id}
                  onClick={() => onCardClick?.(item)}
                >
                  <div className="card-id">{item.id}</div>
                  <div className="card-summary">{item.summary}</div>
                  <div className="card-meta">
                    <span className="tag tag-execution">{EXECUTION_STATE_LABELS[item.executionState] || item.executionState}</span>
                    <span className="tag tag-policy">{AI_POLICY_LABELS[item.aiPolicy] || item.aiPolicy}</span>
                  </div>
                  <div className="card-readiness">
                    就绪检查 {met}/{total}
                    <div className="readiness-bar">
                      <div className="readiness-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  <div className="card-next">
                    <strong>下一步：</strong>
                    {deriveNextAction(item)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
