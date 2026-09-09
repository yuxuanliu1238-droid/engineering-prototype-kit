import { reviewConfig } from "./config.js";
import { Badge, SourceBadge } from "./components.jsx";
export function ReviewCenter({ statuses, launch, record }) {
  return (
    <div className="review-shell">
      <header className="review-header">
        <div className="brand light">
          <b>K</b>
          <div>
            <strong>{{PROJECT_NAME}} · 评审中心</strong>
            <span>独立评审入口，不属于客户生产菜单</span>
          </div>
        </div>
        <button className="secondary" onClick={() => launch(null, "/app")}>
          进入业务系统
        </button>
      </header>
      <main className="review-main">
        <section className="review-hero">
          <div>
            <Badge tone="blue">{{MODE}}</Badge>
            <h1>选择本轮需要验证的场景</h1>
            <p>场景认可只在当前评审目标内生效，不自动构成业务需求确认或模式切换。</p>
          </div>
          <div>
            <span>场景数量</span>
            <strong>{reviewConfig.scenarios.length}</strong>
            <small>来源、假设和待确认问题保持分层</small>
          </div>
        </section>
        <section className="review-grid">
          {reviewConfig.scenarios.map((scenario) => (
            <article className="scenario-card" key={scenario.id}>
              <header>
                <div>
                  <span>{scenario.category}</span>
                  <h2>{scenario.name}</h2>
                </div>
                <Badge
                  tone={
                    statuses[scenario.id] === "已认可"
                      ? "green"
                      : statuses[scenario.id] === "评审中"
                        ? "blue"
                        : "plain"
                  }
                >
                  {statuses[scenario.id] || "待评审"}
                </Badge>
              </header>
              <div className="question">
                <span>本次需要判断</span>
                <strong>{scenario.validationQuestion}</strong>
              </div>
              <dl>
                <div>
                  <dt>前置条件</dt>
                  <dd>{scenario.preconditions.join("；")}</dd>
                </div>
                <div>
                  <dt>预期结果</dt>
                  <dd>{scenario.expectedResult}</dd>
                </div>
              </dl>
              <div className="source-row">
                {scenario.sources.map((source) => (
                  <SourceBadge key={source} source={source} />
                ))}
              </div>
              <footer>
                <button className="secondary" onClick={() => record(scenario.id)}>
                  记录结论
                </button>
                <button className="primary" onClick={() => launch(scenario.id, scenario.entryPath)}>
                  开始演示 →
                </button>
              </footer>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
export function EvaluationBar({ scenario, back, reset }) {
  if (!scenario) return null;
  return (
    <div className="evaluation-bar">
      <div>
        <Badge tone="blue">评审场景</Badge>
        <strong>{scenario.name}</strong>
        <span>{scenario.validationQuestion}</span>
      </div>
      <div>
        <button onClick={back}>← 返回评审中心</button>
        <button onClick={reset}>重置场景</button>
      </div>
    </div>
  );
}
export function ConclusionModal({ scenario, close, confirm }) {
  if (!scenario) return null;
  return (
    <div className="modal-mask" onClick={close}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>场景结论</span>
            <h2>{scenario.name}</h2>
          </div>
          <button onClick={close}>×</button>
        </header>
        <p>此操作只记录当前浏览器中的演示状态；正式结论仍需由产品经理在评审材料中确认。</p>
        <div>
          <button onClick={() => confirm("已认可")}>已认可</button>
          <button onClick={() => confirm("需调整")}>需调整</button>
          <button onClick={() => confirm("暂缓")}>暂缓</button>
        </div>
      </section>
    </div>
  );
}
