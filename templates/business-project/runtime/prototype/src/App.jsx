import { useEffect, useMemo, useState } from "react";
import reviewConfig from "./review-scenarios.json";

const NAVIGATION = [
  ["overview", "总", "工作台"],
  ["records", "单", "业务列表"],
  ["rules", "规", "规则配置"],
  ["exceptions", "异", "异常中心"],
];

const SOURCE_LABELS = {
  "material-explicit": "材料明确",
  "flow-inferred": "流程推导",
  "ai-candidate": "AI 候选",
  "product-confirmed": "产品确认",
};

function readLocation() {
  const path = window.location.pathname;
  if (path.startsWith("/review")) return { surface: "review", page: "review", scenario: null };
  if (path === "/") return { surface: reviewConfig.reviewCenterEnabled ? "review" : "app", page: reviewConfig.reviewCenterEnabled ? "review" : "overview", scenario: null };
  return { surface: "app", page: path.replace(/^\/app\/?/, "") || "overview", scenario: new URLSearchParams(window.location.search).get("scenario") };
}

function Badge({ children, tone = "plain" }) { return <span className={`badge ${tone}`}>{children}</span>; }
function SourceBadge({ source }) { return <span className={`source ${source}`}>{SOURCE_LABELS[source] || source}</span>; }

function ReviewCenter({ statuses, launch, record }) {
  return <div className="review-shell"><header className="review-header"><div className="brand light"><b>K</b><div><strong>{{PROJECT_NAME}} · 评审中心</strong><span>独立评审入口，不属于客户生产菜单</span></div></div><button className="secondary" onClick={() => launch(null, "/app")}>进入业务系统</button></header><main className="review-main"><section className="review-hero"><div><Badge tone="blue">{{MODE}}</Badge><h1>选择本轮需要验证的场景</h1><p>场景认可只在当前评审目标内生效，不自动构成业务需求确认或模式切换。</p></div><div><span>场景数量</span><strong>{reviewConfig.scenarios.length}</strong><small>来源、假设和待确认问题保持分层</small></div></section><section className="review-grid">{reviewConfig.scenarios.map((scenario) => <article className="scenario-card" key={scenario.id}><header><div><span>{scenario.category}</span><h2>{scenario.name}</h2></div><Badge tone={statuses[scenario.id] === "已认可" ? "green" : statuses[scenario.id] === "评审中" ? "blue" : "plain"}>{statuses[scenario.id] || "待评审"}</Badge></header><div className="question"><span>本次需要判断</span><strong>{scenario.validationQuestion}</strong></div><dl><div><dt>前置条件</dt><dd>{scenario.preconditions.join("；")}</dd></div><div><dt>预期结果</dt><dd>{scenario.expectedResult}</dd></div></dl><div className="source-row">{scenario.sources.map((source) => <SourceBadge key={source} source={source} />)}</div><footer><button className="secondary" onClick={() => record(scenario.id)}>记录结论</button><button className="primary" onClick={() => launch(scenario.id, scenario.entryPath)}>开始演示 →</button></footer></article>)}</section></main></div>;
}

function EvaluationBar({ scenario, back, reset }) {
  if (!scenario) return null;
  return <div className="evaluation-bar"><div><Badge tone="blue">评审场景</Badge><strong>{scenario.name}</strong><span>{scenario.validationQuestion}</span></div><div><button onClick={back}>← 返回评审中心</button><button onClick={reset}>重置场景</button></div></div>;
}

function Header({ title, subtitle }) { return <header className="page-header"><div><p>{{PROJECT_NAME}} / {title}</p><h1>{title}</h1><span>{subtitle}</span></div><div className="avatar">PM</div></header>; }
function DemoNotice() { return <div className="notice"><i />当前为快速验证 Demo，页面内容和数据需根据已确认蓝图逐步替换。</div>; }

function Overview({ navigate }) {
  return <><Header title="工作台" subtitle="聚合展示当前业务结果和需要关注的事项" /><DemoNotice /><section className="metrics">{[["今日业务量", "1,286", "演示数据"], ["待处理", "18", "等待当前角色操作"], ["异常事项", "6", "需要人工关注"], ["完成率", "94.2%", "统计口径待确认"]].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section><section className="dashboard-grid"><article className="panel"><PanelTitle title="业务状态分布" action="进入业务列表" onClick={() => navigate("/app/records")} /><div className="bars">{[["待处理", "18", 28], ["处理中", "42", 58], ["已完成", "986", 92]].map(([label, value, width]) => <div key={label}><span>{label}</span><strong>{value}</strong><i style={{ width: `${width}%` }} /></div>)}</div></article><article className="panel"><PanelTitle title="需要关注" action="进入异常中心" onClick={() => navigate("/app/exceptions")} /><div className="alerts"><p><b>!</b><span><strong>示例异常需要处理</strong><small>责任人和恢复条件待确认</small></span></p><p><b>↗</b><span><strong>候选规则影响当前结果</strong><small>可进入规则配置查看</small></span></p></div></article></section></>;
}

function PanelTitle({ title, action, onClick }) { return <div className="panel-title"><h2>{title}</h2>{action && <button onClick={onClick}>{action}</button>}</div>; }

function Records() {
  const [state, setState] = useState("待处理");
  const [drawer, setDrawer] = useState(false);
  return <><Header title="业务列表" subtitle="使用筛选、状态和最后一列操作组织日常工作" /><DemoNotice /><section className="panel table-panel"><div className="tools"><PanelTitle title="业务记录" /><label>⌕ <input placeholder="搜索编号或名称" /></label><button>全部状态⌄</button></div><div className="table"><header><span>业务编号</span><span>业务对象</span><span>来源</span><span>更新时间</span><span>状态</span><span>操作</span></header><div className="focused"><strong>DEMO-001</strong><span>核心流程演示记录</span><span>示例输入</span><span>刚刚</span><Badge tone={state === "已完成" ? "green" : "amber"}>{state}</Badge><button className="table-action" onClick={() => setDrawer(true)}>{state === "已完成" ? "查看" : "处理"}</button></div><div><strong>DEMO-002</strong><span>普通业务记录</span><span>示例输入</span><span>10 分钟前</span><Badge>处理中</Badge><button className="link">查看</button></div></div></section>{drawer && <div className="drawer-mask" onClick={() => setDrawer(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><header><div><p>BUSINESS ACTION</p><h2>{state === "已完成" ? "业务详情" : "处理业务记录"}</h2><span>DEMO-001</span></div><button onClick={() => setDrawer(false)}>×</button></header><main><section><h3>当前信息</h3><div className="info-grid"><Info label="当前状态" value={state} /><Info label="当前责任人" value="示例角色" /><Info label="下一动作" value={state === "已完成" ? "无" : "确认处理结果"} /></div></section><section><h3>操作结果</h3><p>这里应根据业务蓝图替换为真实场景所需的字段、校验和状态反馈。</p></section></main><footer><button className="secondary" onClick={() => setDrawer(false)}>取消</button>{state !== "已完成" && <button className="primary" onClick={() => { setState("已完成"); setDrawer(false); }}>确认并完成</button>}</footer></aside></div>}</>;
}

function Info({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function Rules() {
  return <><Header title="规则配置" subtitle="使用规则集列表和分组详情解释业务判断" /><DemoNotice /><div className="rule-layout"><section className="panel rule-list"><PanelTitle title="规则集" /><button className="selected"><strong>核心流程候选规则</strong><span>适用范围待确认</span><Badge tone="green">启用</Badge></button><button><strong>其他规则集</strong><span>本轮非范围</span><Badge>停用</Badge></button></section><section className="panel rule-detail"><div className="detail-title"><div><span>规则集详情</span><h2>核心流程候选规则</h2><SourceBadge source="ai-candidate" /></div><button className="primary">编辑候选配置</button></div>{[["01", "适用范围", "角色、对象和触发条件"], ["02", "判断口径", "输入字段、优先级和计算方式"], ["03", "异常处理", "阻断结果、责任人和恢复条件"]].map(([number, title, text]) => <section className="rule-group" key={number}><header><span>{number}</span><strong>{title}</strong><SourceBadge source="ai-candidate" /></header><p>{text}</p></section>)}</section></div></>;
}

function Exceptions() {
  return <><Header title="异常中心" subtitle="统一展示阻断原因、责任人和下一动作" /><DemoNotice /><section className="panel table-panel"><div className="tools"><PanelTitle title="异常列表" /><button>全部类型⌄</button><button>全部状态⌄</button></div><div className="table exception"><header><span>异常编号</span><span>异常类型</span><span>关联对象</span><span>责任人</span><span>状态</span><span>下一动作</span></header><div className="focused"><strong>EXP-001</strong><span>示例业务异常</span><span>DEMO-001</span><span>示例角色</span><Badge tone="amber">待处理</Badge><button className="table-action">处理</button></div></div></section><div className="boundary"><strong>原型边界</strong><p>异常类型、责任人和恢复条件均为 AI 候选，未获得产品确认前不得写成正式业务规则。</p></div></>;
}

function BusinessShell({ location, navigate, back, reset }) {
  const scenario = reviewConfig.scenarios.find((item) => item.id === location.scenario);
  const navigateWithin = (path) => scenario && !path.includes("scenario=") ? navigate(`${path}${path.includes("?") ? "&" : "?"}scenario=${scenario.id}`) : navigate(path);
  const pages = useMemo(() => ({ overview: <Overview navigate={navigateWithin} />, records: <Records />, rules: <Rules />, exceptions: <Exceptions /> }), [location.page, location.scenario]);
  return <div className="app-shell"><aside><div className="brand"><b>K</b><div><strong>{{PROJECT_NAME}}</strong><span>业务原型</span></div></div><nav>{NAVIGATION.map(([id, icon, label]) => <button key={id} className={location.page === id ? "active" : ""} onClick={() => navigateWithin(`/app/${id}`)}><i>{icon}</i>{label}</button>)}</nav><footer><span>{{MODE}}</span><strong>Kit {{KIT_VERSION}}</strong><small>演示数据 · 非生产系统</small></footer></aside><div className="business-content"><EvaluationBar scenario={scenario} back={back} reset={reset} /><main>{pages[location.page] || pages.overview}</main></div></div>;
}

function ConclusionModal({ scenario, close, confirm }) {
  if (!scenario) return null;
  return <div className="modal-mask" onClick={close}><section className="modal" onClick={(event) => event.stopPropagation()}><header><div><span>场景结论</span><h2>{scenario.name}</h2></div><button onClick={close}>×</button></header><p>此操作只记录当前浏览器中的演示状态；正式结论仍需由产品经理在评审材料中确认。</p><div><button onClick={() => confirm("已认可")}>已认可</button><button onClick={() => confirm("需调整")}>需调整</button><button onClick={() => confirm("暂缓")}>暂缓</button></div></section></div>;
}

export default function App() {
  const [location, setLocation] = useState(readLocation);
  const [statuses, setStatuses] = useState({});
  const [conclusion, setConclusion] = useState(null);
  const [demoKey, setDemoKey] = useState(0);
  useEffect(() => { if (window.location.pathname === "/") window.history.replaceState({}, "", reviewConfig.reviewCenterEnabled ? reviewConfig.reviewRoute : reviewConfig.businessRoute); const listener = () => setLocation(readLocation()); window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); }, []);
  const navigate = (path) => { window.history.pushState({}, "", path); setLocation(readLocation()); window.scrollTo(0, 0); };
  const launch = (id, path) => { if (id) setStatuses((old) => ({ ...old, [id]: old[id] || "评审中" })); navigate(path); };
  return <>{location.surface === "review" && reviewConfig.reviewCenterEnabled ? <ReviewCenter statuses={statuses} launch={launch} record={(id) => setConclusion(reviewConfig.scenarios.find((item) => item.id === id))} /> : <BusinessShell key={demoKey} location={location} navigate={navigate} back={() => navigate(reviewConfig.reviewRoute)} reset={() => setDemoKey((value) => value + 1)} />}{conclusion && <ConclusionModal scenario={conclusion} close={() => setConclusion(null)} confirm={(status) => { setStatuses((old) => ({ ...old, [conclusion.id]: status })); setConclusion(null); }} />}</>;
}
