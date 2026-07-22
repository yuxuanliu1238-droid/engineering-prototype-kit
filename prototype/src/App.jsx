import { useMemo, useState } from "react";

const stages = [
  ["01", "业务探索", "分离事实、假设、角色、流程和待确认问题"],
  ["02", "Demo 规划", "用一条主流程和最小页面集合暴露理解错误"],
  ["03", "交互原型", "使用本地 fixtures 验证界面、操作和结果反馈"],
  ["04", "决策建模", "沉淀正负向决策、领域对象和可测试状态机"],
  ["05", "页面契约", "用稳定 ID 记录动作、状态、异常和验收事实"],
  ["06", "质量审查", "先报告冲突，经人工确认后再修复"],
  ["07", "变更治理", "登记、影响分析、授权、同步、评审和证据"],
  ["08", "评审交付", "检查通过后生成静态站点和可下载 ZIP"],
];

const readinessItems = [
  "业务资料已放入 inbox",
  "资料中不包含密钥、令牌或密码",
  "知道首轮只做业务探索，不直接建设正式系统",
];

const taskChecks = ["目标明确", "范围清晰", "验收可验证", "实施已授权"];

const policies = [
  ["planning-only", "仅允许规划"],
  ["execution-allowed", "允许范围内实施"],
];

export default function App() {
  const [checked, setChecked] = useState([]);
  const [taskChecked, setTaskChecked] = useState([]);
  const [policy, setPolicy] = useState("planning-only");
  const ready = checked.length === readinessItems.length;
  const completedText = useMemo(
    () => `${checked.length}/${readinessItems.length}`,
    [checked.length],
  );
  const taskVerdict = useMemo(() => {
    if (policy === "planning-only" && taskChecked.includes(0)) {
      return {
        code: "planning-ready",
        state: "ready",
        text: "可以分析、提问和拆分，不得修改目标文件。",
      };
    }
    if (policy === "execution-allowed" && taskChecked.length === taskChecks.length) {
      return {
        code: "execution-ready",
        state: "ready",
        text: "授权和就绪条件都已满足，可在范围内实施。",
      };
    }
    return {
      code: "needs-input",
      state: "locked",
      text: "授权不等于已就绪；补齐缺失项后才能解锁。",
    };
  }, [policy, taskChecked]);

  function toggle(index) {
    setChecked((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  }

  function toggleTaskCheck(index) {
    setTaskChecked((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  }

  return (
    <main>
      <section className="hero">
        <nav>
          <span className="brand">Prototype OS</span>
          <span className="version">Starter Kit · V0.2</span>
        </nav>

        <div className="hero-grid">
          <div>
            <p className="eyebrow">给产品经理的工程化原型工作台</p>
            <h1>
              不从空白目录开始，
              <br />
              从正确的问题开始。
            </h1>
            <p className="summary">
              把业务资料逐步转化为可运行、可验证、可审查、可追溯的前端原型。
              AI 负责执行和检查，产品经理保留业务决策与范围控制。
            </p>
            <div className="start-prompt">
              <span>在 Codex 中发送</span>
              <strong>
                开始工程化原型项目。资料已放在 inbox，请先做业务探索。
              </strong>
            </div>
          </div>

          <aside className={`readiness ${ready ? "is-ready" : ""}`}>
            <div className="readiness-head">
              <div>
                <span className="micro">START CHECK</span>
                <h2>开始前核对</h2>
              </div>
              <span className="counter">{completedText}</span>
            </div>
            <div className="check-list">
              {readinessItems.map((item, index) => (
                <button
                  className={checked.includes(index) ? "checked" : ""}
                  key={item}
                  onClick={() => toggle(index)}
                  type="button"
                >
                  <span className="check-mark">
                    {checked.includes(index) ? "✓" : ""}
                  </span>
                  {item}
                </button>
              ))}
            </div>
            <p className="readiness-result">
              {ready
                ? "准备完成。现在可以让 Codex 开始业务探索。"
                : "逐项确认后再启动，避免资料污染和范围误解。"}
            </p>
          </aside>
        </div>
      </section>

      <section className="workflow">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GUIDED WORKFLOW</p>
            <h2>八个阶段，一个事实链路</h2>
          </div>
          <p>
            每个阶段只解决当前问题；关键业务结论、需求实施和正式交付都保留人工门禁。
          </p>
        </div>
        <div className="stage-grid">
          {stages.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="control-plane">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TASK CONTROL</p>
            <h2>先判断能不能做，再让 AI 开始做。</h2>
          </div>
          <p>
            阶段记录交付位置，执行状态记录当前是否可执行，两者不再混用。
          </p>
        </div>

        <div className="control-grid">
          <div className="control-editor">
            <div className="control-block">
              <span className="micro">AI POLICY</span>
              <div className="policy-options">
                {policies.map(([value, label]) => (
                  <button
                    className={policy === value ? "active" : ""}
                    key={value}
                    onClick={() => setPolicy(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-block">
              <span className="micro">READINESS CHECK</span>
              <div className="task-checks">
                {taskChecks.map((item, index) => (
                  <button
                    className={taskChecked.includes(index) ? "checked" : ""}
                    key={item}
                    onClick={() => toggleTaskCheck(index)}
                    type="button"
                  >
                    <span>{taskChecked.includes(index) ? "✓" : ""}</span>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="verdict-card" aria-live="polite">
            <span className="micro">DETERMINISTIC VERDICT</span>
            <strong>{taskVerdict.code}</strong>
            <dl>
              <div>
                <dt>当前阶段</dt>
                <dd>impact-analysis</dd>
              </div>
              <div>
                <dt>执行状态</dt>
                <dd>{taskVerdict.state}</dd>
              </div>
              <div>
                <dt>AI 策略</dt>
                <dd>{policy}</dd>
              </div>
            </dl>
            <p>{taskVerdict.text}</p>
          </aside>
        </div>
      </section>

      <section className="guardrails">
        <div>
          <p className="eyebrow">BUILT-IN GUARDRAILS</p>
          <h2>新人容易遗漏的约束，放进流程里。</h2>
        </div>
        <div className="guardrail-list">
          <div>
            <strong>事实不混用</strong>
            <p>事实、假设、历史信息、决策和技术建议各有归属。</p>
          </div>
          <div>
            <strong>需求不越权</strong>
            <p>登记不等于实施，影响分析不等于自动修改。</p>
          </div>
          <div>
            <strong>完成有证据</strong>
            <p>产物必须有类型、位置，并说明支撑哪条验收事实。</p>
          </div>
        </div>
      </section>

      <footer>
        <span>当前页面是启动包自身的中性占位页，不代表任何业务需求。</span>
        <span>React + Vite · Local fixtures only</span>
      </footer>
    </main>
  );
}
