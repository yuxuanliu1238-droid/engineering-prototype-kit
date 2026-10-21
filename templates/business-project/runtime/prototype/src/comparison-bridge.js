function publish(message) {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
}
export function publishReviewLocation(location) {
  const parts = (location.page || "").split("/");
  publish({ type: "prototype-review-location", location: { ...location, page: parts[0], detailId: location.detailId || parts[1] || null, mode: location.mode || new URLSearchParams(window.location.search).get("mode") } });
}
// Pair active=true on opening an action panel with active=false on close/unmount.
export function publishReviewAction(action, active = true) {
  publish({ type: "prototype-review-action", action, active });
}
