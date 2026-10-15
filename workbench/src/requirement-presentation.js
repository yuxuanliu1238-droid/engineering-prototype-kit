// Presentation-only helpers: no writes, inferred timestamps, or inferred relationships.
export function formatRecordTime(value) {
  if (!value) return {date: "日期未记录", time: "具体时间未记录"};
  if (!/\d{2}:\d{2}/.test(value)) return {date: value, time: "具体时间未记录"};
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return {date: value, time: "时间格式待核对"};
  return {
    date: date.toLocaleDateString("sv-SE", {timeZone: "Asia/Shanghai"}),
    time: date.toLocaleTimeString("zh-CN", {timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false}) + " · 上海时间",
  };
}

export function buildEvidenceGraph(record, pages) {
  const nodes = [{id: record.id, type: "requirement", title: record.id, body: record.title, source: record.source, x:50, y:50}];
  record.pages.forEach((id, index) => {
    const page = pages.find(item => item.id === id);
    nodes.push({id: `page:${id}`, type: "page", title: page?.title || id, body: page?.goal || "尚未读取页面摘要", source: page?.source || record.source, x: index % 2 ? 30 : 13, y: 18 + Math.floor(index / 2) * 32});
  });
  record.evidence.forEach((evidence, index) => {
    const title = evidence.type === "file" ? evidence.reference.split("/").slice(-2).join("/") : evidence.type === "check" ? `检查记录 ${index + 1}` : `台账备注 ${index + 1}`;
    nodes.push({id: `evidence:${index}`, type: evidence.type, title, body: evidence.reference, source: record.source, evidence, x: index % 2 ? 87 : 70, y: 18 + Math.floor(index / 2) * 32});
  });
  (record.documents || []).forEach((reference,index) => nodes.push({id:`document:${index}`,type:"document",title:reference.split("/").at(-1),body:reference,source:record.source}));
  // A spoke means only “referenced by this requirement”, never causality or proof of completion.
  return {nodes:[nodes[0],...positionGraphNodes(nodes.slice(1))], edges: nodes.slice(1).map(node => ({from: record.id, to: node.id}))};
}

function positionGraphNodes(nodes) {
  const midpoint = Math.ceil(nodes.length / 2);
  return nodes.map((node,index) => {
    const left = index < midpoint;
    const localIndex = left ? index : index-midpoint;
    const rows = Math.ceil((left ? midpoint : nodes.length-midpoint)/2);
    return {...node,x:left ? (localIndex%2 ? 30:13) : (localIndex%2 ? 87:70),y:rows<=1 ? 50 : 18+Math.floor(localIndex/2)*64/(rows-1)};
  });
}

export function paginateEvidenceGraph(graph, requestedPage=0) {
  const related = graph.nodes.slice(1);
  const totalPages = Math.max(1,Math.ceil(related.length/12));
  const page = Math.max(0,Math.min(totalPages-1,requestedPage));
  const nodes = [graph.nodes[0],...positionGraphNodes(related.slice(page*12,page*12+12))];
  const visibleIds = new Set(nodes.map(node=>node.id));
  return {...graph,nodes,edges:graph.edges.filter(edge=>visibleIds.has(edge.to)),page,totalPages,total:related.length};
}
