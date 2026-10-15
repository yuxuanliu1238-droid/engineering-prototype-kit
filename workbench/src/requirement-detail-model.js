// Explicit projection of source fields. No status promotion or inferred evidence.
export function buildDetailSnapshot(registry, metadata) {
  const stages = registry.workflow?.stages || [];
  const labels = new Map(stages.map(stage => [stage.id, stage.label]));
  return {
    ...metadata,
    projectId: registry.project.id,
    items: registry.requirements.map(item => {
      const results = item.stageResults || {};
      const order = [...new Set([...stages.map(stage => stage.id), ...Object.keys(results), item.currentStageId])].filter(Boolean);
      return {
        id: item.id, title: item.title,
        stageId: item.currentStageId || "unknown",
        stage: labels.get(item.currentStageId) || item.currentStageId || "阶段未记录",
        note: results[item.currentStageId]?.note || "当前阶段结论未记录",
        executionState: item.taskControl?.executionState || "unknown",
        waiting: item.taskControl?.waitingReason || null,
        pendingQuestions: item.pendingQuestions || [],
        notes: item.notes || [],
        scope: item.taskControl?.executionScope?.label || null,
        allowedArtifactTypes: item.taskControl?.executionScope?.allowedArtifactTypes || [],
        deferredArtifactTypes: item.taskControl?.executionScope?.deferredArtifactTypes || [],
        pages: [...new Set(item.impact?.pageIds || [])],
        documents: [...new Set(item.documents || [])],
        evidence: (item.evidence || []).map(evidence => ({type:evidence.type,reference:evidence.reference,result:evidence.result ?? null})),
        stages: order.filter(id => results[id] || id === item.currentStageId).map(id => ({
          id, label:labels.get(id) || id, status:results[id]?.status || "unrecorded",
          updatedAt:results[id]?.recordedAt || results[id]?.updatedAt || null, note:results[id]?.note || "该阶段记录尚未提供",
        })),
        confirmedAt: item.confirmedAt || null,
        requirementType: item.requirementType || null,
        impactTags: item.impactTags || [],
        lifecycle: item.workbenchLifecycle || null,
        workbenchTemplate: item.workbenchTemplate || null,
        hasWorkbenchAnalysis: Boolean(item.workbenchAnalysis),
        hasPrototypeAuthorization: Boolean(item.workbenchImplementationAuthorization),
        prototypeTargets: item.workbenchImplementationAuthorization?.plan?.targets || [],
      };
    }),
  };
}

export function currentStageFor(record) {
  return record.stages?.find(stage => stage.id === record.stageId) || record.stages?.find(stage => stage.label === record.stage)
    || {id:"unrecorded",label:record.stage || "阶段未记录",status:"unrecorded",updatedAt:null,note:"当前阶段记录尚未提供"};
}

export function requirementConclusion(record) {
  if (record.executionState === "completed") return record.id === "CR-029" ? "工程化原型已完成" : "本轮需求已完成";
  if (record.executionState === "cancelled") return "台账记录已取消";
  if (record.waiting?.question) return "等待你的确认";
  return record.scope || "当前范围尚未记录";
}
