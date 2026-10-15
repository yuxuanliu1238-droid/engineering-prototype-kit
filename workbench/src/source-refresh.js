export const SOURCE_CACHE_KEY = "product-os-cx-readonly-v1";
export const SOURCE_REFRESH_URL = "/api/read-only/cx-recycle/requirements";

export function validateSourceSnapshot(value) {
  const string = x => typeof x === "string";
  const strings = x => Array.isArray(x) && x.every(string);
  const optionalString = x => x == null || string(x);
  const validItem = item => item && string(item.id) && item.id.length > 0 && string(item.title)
    && ["stageId","stage","note","executionState"].every(key => string(item[key]))
    && ["notes","pages","documents","allowedArtifactTypes","deferredArtifactTypes"].every(key => strings(item[key]))
    && optionalString(item.scope) && optionalString(item.confirmedAt) && optionalString(item.requirementType)
    && (item.impactTags == null || strings(item.impactTags))
    && (item.lifecycle == null || (typeof item.lifecycle === "object" && string(item.lifecycle.state) && string(item.lifecycle.activity)))
    && (item.workbenchTemplate == null || typeof item.workbenchTemplate === "object")
    && (item.hasWorkbenchAnalysis == null || typeof item.hasWorkbenchAnalysis === "boolean")
    && (item.hasPrototypeAuthorization == null || typeof item.hasPrototypeAuthorization === "boolean")
    && (item.prototypeTargets == null || strings(item.prototypeTargets))
    && (item.waiting == null || (typeof item.waiting === "object" && ["question","impact","resumeWhen"].every(key=>optionalString(item.waiting[key]))))
    && Array.isArray(item.pendingQuestions) && item.pendingQuestions.every(x=>string(x) || (x && typeof x === "object" && optionalString(x.question) && optionalString(x.title)))
    && Array.isArray(item.stages) && item.stages.every(stage=>stage && ["id","label","status","note"].every(key=>string(stage[key])) && optionalString(stage.updatedAt))
    && new Set(item.stages.map(stage=>stage.id)).size === item.stages.length
    && Array.isArray(item.evidence) && item.evidence.every(e=>e && string(e.type) && string(e.reference) && optionalString(e.result) && (e.exists == null || typeof e.exists === "boolean"));
  if (!value || value.projectId !== "cx-recycle" || value.source !== "docs/requirements/registry.json"
    || !string(value.readAt) || !Number.isFinite(Date.parse(value.readAt)) || !/^[a-f0-9]{64}$/.test(value.sha256 || "")
    || !Array.isArray(value.items) || !value.items.every(validItem) || new Set(value.items.map(x=>x.id)).size !== value.items.length) throw new Error("INVALID_SNAPSHOT");
  return value;
}

export function sourceChanges(before, after) {
  const previous = new Map(before.items.map(item=>[item.id,item]));
  const next = new Map(after.items.map(item=>[item.id,item]));
  return {
    added:after.items.filter(item=>!previous.has(item.id)),
    removed:before.items.filter(item=>!next.has(item.id)),
    updated:after.items.filter(item=>previous.has(item.id) && JSON.stringify(previous.get(item.id)) !== JSON.stringify(item)),
  };
}

export function readCachedSource(storage, fallback) {
  try {
    const raw=storage.getItem(SOURCE_CACHE_KEY);
    if (!raw) return {snapshot:fallback, warning:""};
    return {snapshot:validateSourceSnapshot(JSON.parse(raw)),warning:""};
  } catch { return {snapshot:fallback,warning:"本地缓存无法读取，已显示内置快照；原缓存未改动。"}; }
}

export async function fetchAndSaveSource({ fetcher, storage, previous, signal }) {
  const response=await fetcher(SOURCE_REFRESH_URL,{method:"GET",cache:"no-store",signal,headers:{Accept:"application/json"}});
  if (!response.ok) throw new Error("READ_FAILED");
  const next=validateSourceSnapshot(await response.json());
  signal?.throwIfAborted();
  const changes=sourceChanges(previous,next);
  // Save before replacement. Storage failures must not replace the last usable view.
  storage.setItem(SOURCE_CACHE_KEY,JSON.stringify(next));
  return {snapshot:next,changes};
}
