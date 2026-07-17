export const IMPLEMENTATION_STATUSES = Object.freeze([
  "implemented",
  "partial",
  "planned",
]);

export function section(id, title, description, implementationStatus = "implemented") {
  return { id, title, description, implementationStatus };
}

export function action(
  id,
  label,
  trigger,
  {
    preconditions = [],
    validations = [],
    successResult,
    nextPageId = null,
    dataEffects = [],
    failureHandling,
    implementationStatus = "implemented",
  },
) {
  return {
    id,
    label,
    trigger,
    preconditions,
    validations,
    successResult,
    nextPageId,
    dataEffects,
    failureHandling,
    implementationStatus,
  };
}

export function state(
  id,
  label,
  {
    enterWhen,
    visibleChanges,
    allowedActionIds = [],
    recovery,
    implementationStatus = "implemented",
  },
) {
  return {
    id,
    label,
    enterWhen,
    visibleChanges,
    allowedActionIds,
    recovery,
    implementationStatus,
  };
}

export function rule(id, category, description, implementationStatus = "implemented") {
  return { id, category, description, implementationStatus };
}

export function dataField(
  id,
  name,
  source,
  required,
  purpose,
  sensitivity = "internal",
) {
  return { id, name, source, required, purpose, sensitivity };
}

export function integration(
  id,
  name,
  direction,
  trigger,
  requestFields,
  responseFields,
  failureHandling,
  status = "placeholder",
) {
  return {
    id,
    name,
    direction,
    trigger,
    requestFields,
    responseFields,
    failureHandling,
    status,
  };
}

export function exception(id, trigger, handling, implementationStatus = "implemented") {
  return { id, trigger, handling, implementationStatus };
}

export function acceptance(
  id,
  given,
  when,
  then,
  implementationStatus = "implemented",
) {
  return { id, given, when, then, implementationStatus };
}

export function makePage(contract) {
  return { schemaVersion: 1, ...contract };
}
