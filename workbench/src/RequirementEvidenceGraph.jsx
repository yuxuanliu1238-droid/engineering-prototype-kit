import { useState } from "react";
import { buildEvidenceGraph, paginateEvidenceGraph } from "./requirement-presentation";

const types = {requirement: "需求", page: "关联页面", file: "关联文件", document:"关联文档", check: "历史检查", note: "台账备注"};

export default function RequirementEvidenceGraph({ record, pages }) {
  const [pageIndex, setPageIndex] = useState(0);
  const graph = paginateEvidenceGraph(buildEvidenceGraph(record, pages),pageIndex);
  const [selectedId, setSelectedId] = useState(record.id);
  const selected = graph.nodes.find(node => node.id === selectedId) || graph.nodes[0];
  return <section className="overview-section">
    <div className="overview-heading"><h3>证据关系</h3><span>{graph.total} 个关联节点 · 点击查看来源</span></div>
    {graph.total === 0 && <p className="snapshot-note">台账未登记页面、文档或证据，只显示需求节点。</p>}
    {graph.totalPages > 1 && <div className="graph-pagination"><button className="text-button" disabled={graph.page===0} onClick={()=>{setPageIndex(graph.page-1);setSelectedId(record.id);}}>上一组</button><span>{graph.page+1} / {graph.totalPages} · 每组最多 12 个节点</span><button className="text-button" disabled={graph.page===graph.totalPages-1} onClick={()=>{setPageIndex(graph.page+1);setSelectedId(record.id);}}>下一组</button></div>}
    <div className="evidence-network">
      <div className="network-legend"><span>● 页面</span><span>● 文件／文档</span><span>● 检查</span><span>● 备注</span></div>
      <div className="network-scroll" role="group" aria-label={`${record.id} 关联证据图`}>
        <div className="network-canvas">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{graph.edges.map(edge => {const node = graph.nodes.find(n => n.id === edge.to);return <line key={edge.to} x1="50" y1="50" x2={node.x} y2={node.y} className={selectedId === edge.to ? "selected-edge" : ""} />;})}</svg>
          {graph.nodes.map(node => <button key={node.id} className={`knowledge-node node-${node.type}`} style={{left:`${node.x}%`,top:`${node.y}%`}} onClick={() => setSelectedId(node.id)} aria-pressed={selected.id === node.id} aria-label={`${types[node.type]}：${node.title}`} title={node.body}><span className="node-dot" /><span className="node-caption">{node.title}</span></button>)}
        </div>
      </div>
      <div className="network-inspector" aria-live="polite"><span className="section-kicker">{types[selected.type] || "证据"}</span><h4>{selected.title}</h4><p>{selected.body}</p>{selected.evidence?.type === "check" && <small>台账结果：{selected.evidence.result === "passed" ? "通过" : selected.evidence.result || "未记录"} · 本轮未复测</small>}{selected.evidence?.type === "file" && <small>{selected.evidence.exists === true ? "读取时文件存在，未核验内容" : selected.evidence.exists === false ? "读取时未找到文件" : "文件存在性未核验"}</small>}{selected.type === "document" && <small>仅展示台账关联，未读取文档全文</small>}<div className="source-path">来源：{selected.source}</div></div>
    </div>
    <p className="snapshot-note">连线仅表示台账引用，不表示验收通过。{record.documents?.length ? `台账关联了 ${record.documents.length} 份文档。` : "台账未关联正式文档。"}未登记的关联不补画。</p>
  </section>;
}
