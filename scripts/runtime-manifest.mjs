import { templateManifest } from "./template-manifest.mjs";
export { templateManifest } from "./template-manifest.mjs";
export function runtimeEntries({ handoff = false } = {}) {
  return templateManifest.runtimeFiles.filter(
    (e) => !e.capability || (e.capability === "developmentHandoff" && handoff),
  );
}
