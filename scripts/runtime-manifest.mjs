import { promises as fs } from "node:fs";
export const templateManifest = JSON.parse(
  await fs.readFile(
    new URL("../templates/business-project/template-manifest.json", import.meta.url),
    "utf8",
  ),
);
export function runtimeEntries({ handoff = false } = {}) {
  return templateManifest.runtimeFiles.filter(
    (e) => !e.capability || (e.capability === "developmentHandoff" && handoff),
  );
}
