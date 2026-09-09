import { SOURCE_LABELS } from "./config.js";
export function Badge({ children, tone = "plain" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function SourceBadge({ source }) {
  return <span className={`source ${source}`}>{SOURCE_LABELS[source] || source}</span>;
}
export function Header({ title, subtitle }) {
  return (
    <header className="page-header">
      <div>
        <p>{{PROJECT_NAME}} / {title}</p>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
      <div className="avatar">PM</div>
    </header>
  );
}
export function DemoNotice() {
  return (
    <div className="notice">
      <i />
      当前为快速验证 Demo，页面内容和数据需根据已确认蓝图逐步替换。
    </div>
  );
}
export function PanelTitle({ title, action, onClick }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      {action && <button onClick={onClick}>{action}</button>}
    </div>
  );
}
export function Info({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
