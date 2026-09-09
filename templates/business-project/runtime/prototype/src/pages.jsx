import { useState } from "react";
import { Badge, SourceBadge, Header, DemoNotice, PanelTitle, Info } from "./components.jsx";
export function Overview({ navigate }) {
  return (
    <>
      <Header title="工作台" subtitle="聚合展示当前业务结果和需要关注的事项" />
      <DemoNotice />
      <section className="metrics">
        {[
          ["今日业务量", "1,286", "演示数据"],
          ["待处理", "18", "等待当前角色操作"],
          ["异常事项", "6", "需要人工关注"],
          ["完成率", "94.2%", "统计口径待确认"],
        ].map(([label, value, note]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <PanelTitle
            title="业务状态分布"
            action="进入业务列表"
            onClick={() => navigate("/app/records")}
          />
          <div className="bars">
            {[
              ["待处理", "18", 28],
              ["处理中", "42", 58],
              ["已完成", "986", 92],
            ].map(([label, value, width]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <i
                  style={{
                    width: `${width}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <PanelTitle
            title="需要关注"
            action="进入异常中心"
            onClick={() => navigate("/app/exceptions")}
          />
          <div className="alerts">
            <p>
              <b>!</b>
              <span>
                <strong>示例异常需要处理</strong>
                <small>责任人和恢复条件待确认</small>
              </span>
            </p>
            <p>
              <b>↗</b>
              <span>
                <strong>候选规则影响当前结果</strong>
                <small>可进入规则配置查看</small>
              </span>
            </p>
          </div>
        </article>
      </section>
    </>
  );
}
export function Records() {
  const [state, setState] = useState("待处理");
  const [drawer, setDrawer] = useState(false);
  return (
    <>
      <Header title="业务列表" subtitle="使用筛选、状态和最后一列操作组织日常工作" />
      <DemoNotice />
      <section className="panel table-panel">
        <div className="tools">
          <PanelTitle title="业务记录" />
          <label>
            ⌕
            <input
              placeholder="搜索编号或名称"
              disabled
              title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A"
            />
          </label>
          <button disabled title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A">
            全部状态⌄
          </button>
        </div>
        <div className="table">
          <header>
            <span>业务编号</span>
            <span>业务对象</span>
            <span>来源</span>
            <span>更新时间</span>
            <span>状态</span>
            <span>操作</span>
          </header>
          <div className="focused">
            <strong>DEMO-001</strong>
            <span>核心流程演示记录</span>
            <span>示例输入</span>
            <span>刚刚</span>
            <Badge tone={state === "已完成" ? "green" : "amber"}>{state}</Badge>
            <button className="table-action" onClick={() => setDrawer(true)}>
              {state === "已完成" ? "查看" : "处理"}
            </button>
          </div>
          <div>
            <strong>DEMO-002</strong>
            <span>普通业务记录</span>
            <span>示例输入</span>
            <span>10 分钟前</span>
            <Badge>处理中</Badge>
            <button
              className="link"
              disabled
              title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A"
            >
              查看
            </button>
          </div>
        </div>
      </section>
      {drawer && (
        <div className="drawer-mask" onClick={() => setDrawer(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>BUSINESS ACTION</p>
                <h2>{state === "已完成" ? "业务详情" : "处理业务记录"}</h2>
                <span>DEMO-001</span>
              </div>
              <button onClick={() => setDrawer(false)}>×</button>
            </header>
            <main>
              <section>
                <h3>当前信息</h3>
                <div className="info-grid">
                  <Info label="当前状态" value={state} />
                  <Info label="当前责任人" value="示例角色" />
                  <Info label="下一动作" value={state === "已完成" ? "无" : "确认处理结果"} />
                </div>
              </section>
              <section>
                <h3>操作结果</h3>
                <p>这里应根据业务蓝图替换为真实场景所需的字段、校验和状态反馈。</p>
              </section>
            </main>
            <footer>
              <button className="secondary" onClick={() => setDrawer(false)}>
                取消
              </button>
              {state !== "已完成" && (
                <button
                  className="primary"
                  onClick={() => {
                    setState("已完成");
                    setDrawer(false);
                  }}
                >
                  确认并完成
                </button>
              )}
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
export function Rules() {
  return (
    <>
      <Header title="规则配置" subtitle="使用规则集列表和分组详情解释业务判断" />
      <DemoNotice />
      <div className="rule-layout">
        <section className="panel rule-list">
          <PanelTitle title="规则集" />
          <button
            className="selected"
            disabled
            title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A"
          >
            <strong>核心流程候选规则</strong>
            <span>适用范围待确认</span>
            <Badge tone="green">启用</Badge>
          </button>
          <button disabled title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A">
            <strong>其他规则集</strong>
            <span>本轮非范围</span>
            <Badge>停用</Badge>
          </button>
        </section>
        <section className="panel rule-detail">
          <div className="detail-title">
            <div>
              <span>规则集详情</span>
              <h2>核心流程候选规则</h2>
              <SourceBadge source="ai-candidate" />
            </div>
            <button
              className="primary"
              disabled
              title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A"
            >
              编辑候选配置
            </button>
          </div>
          {[
            ["01", "适用范围", "角色、对象和触发条件"],
            ["02", "判断口径", "输入字段、优先级和计算方式"],
            ["03", "异常处理", "阻断结果、责任人和恢复条件"],
          ].map(([number, title, text]) => (
            <section className="rule-group" key={number}>
              <header>
                <span>{number}</span>
                <strong>{title}</strong>
                <SourceBadge source="ai-candidate" />
              </header>
              <p>{text}</p>
            </section>
          ))}
        </section>
      </div>
    </>
  );
}
export function Exceptions() {
  return (
    <>
      <Header title="异常中心" subtitle="统一展示阻断原因、责任人和下一动作" />
      <DemoNotice />
      <section className="panel table-panel">
        <div className="tools">
          <PanelTitle title="异常列表" />
          <button disabled title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A">
            全部类型⌄
          </button>
          <button disabled title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A">
            全部状态⌄
          </button>
        </div>
        <div className="table exception">
          <header>
            <span>异常编号</span>
            <span>异常类型</span>
            <span>关联对象</span>
            <span>责任人</span>
            <span>状态</span>
            <span>下一动作</span>
          </header>
          <div className="focused">
            <strong>EXP-001</strong>
            <span>示例业务异常</span>
            <span>DEMO-001</span>
            <span>示例角色</span>
            <Badge tone="amber">待处理</Badge>
            <button
              className="table-action"
              disabled
              title="\u672C\u8F6E\u672A\u5B9E\u73B0\uFF0C\u4EC5\u5C55\u793A"
            >
              处理
            </button>
          </div>
        </div>
      </section>
      <div className="boundary">
        <strong>原型边界</strong>
        <p>异常类型、责任人和恢复条件均为 AI 候选，未获得产品确认前不得写成正式业务规则。</p>
      </div>
    </>
  );
}
