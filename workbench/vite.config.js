import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceReaderPlugin } from "./server/source-reader.js";
import { analysisPlugin } from "./server/analysis-api.js";
import { scopePlugin } from "./server/scope-confirmation.js";
import {reviewPlugin} from "./server/answer-review.js";
import {implementationPlugin} from "./server/implementation-api.js";
import {acceptancePlugin} from "./server/acceptance-api.js";
import {productionPreparationPlugin} from "./server/production-preparation-api.js";
import {pageGuideAdjustmentPlugin} from "./server/page-guide-adjustment.js";
import {requirementCreatePlugin} from "./server/requirement-create.js";
import {strategyAcceptancePlugin} from "./server/strategy-acceptance-api.js";
import {projectDiscoveryPlugin} from "./server/project-discovery.js";
import {kitProjectRegistrationPlugin} from "./server/kit-project-registration.js";
import {typeRecommendationPlugin} from "./server/type-recommendation-api.js";
import {kitAnalysisPlugin} from "./server/kit-analysis-api.js";
import {kitReplanPlugin} from "./server/kit-replan-api.js";
import {kitSchemePlugin} from "./server/kit-scheme-api.js";
import {kitAuthorizationPlugin} from "./server/kit-authorization-api.js";
import {kitImplementationPlugin} from "./server/kit-implementation-api.js";
import {kitPreviewPlugin} from "./server/kit-preview-api.js";
import {kitReviewPlugin} from "./server/kit-review-api.js";
import {kitAdjustmentPlugin} from "./server/kit-adjustment-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = path.resolve(__dirname, "..");
const REGISTRY_PATH = path.join(KIT_ROOT, "docs/requirements/registry.json");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function registryApiPlugin() {
  return {
    name: "registry-api",
    configureServer(server) {
      server.middlewares.use("/api/registry", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method === "GET") {
          try {
            const data = await fs.readFile(REGISTRY_PATH, "utf-8");
            res.end(data);
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.method === "POST" && req.url === "/items") {
          try {
            const body = await readBody(req);
            const newItem = JSON.parse(body);
            const registry = JSON.parse(await fs.readFile(REGISTRY_PATH, "utf-8"));
            registry.items.push(newItem);
            await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf-8");
            res.end(JSON.stringify({ ok: true, id: newItem.id }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.method === "PUT") {
          const match = req.url.match(/^\/items\/(CR-\d+)$/);
          if (match) {
            try {
              const itemId = match[1];
              const body = await readBody(req);
              const updated = JSON.parse(body);
              const registry = JSON.parse(await fs.readFile(REGISTRY_PATH, "utf-8"));
              const idx = registry.items.findIndex((it) => it.id === itemId);
              if (idx === -1) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "not found" }));
                return;
              }
              registry.items[idx] = updated;
              await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf-8");
              res.end(JSON.stringify({ ok: true, id: itemId }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
        }

        if (req.method === "DELETE") {
          const match = req.url.match(/^\/items\/(CR-\d+)$/);
          if (match) {
            try {
              const itemId = match[1];
              const registry = JSON.parse(await fs.readFile(REGISTRY_PATH, "utf-8"));
              registry.items = registry.items.filter((it) => it.id !== itemId);
              await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf-8");
              res.end(JSON.stringify({ ok: true, id: itemId }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not found" }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), registryApiPlugin(), typeRecommendationPlugin(path.join(__dirname,".local-analysis")), kitProjectRegistrationPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitAnalysisPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitReplanPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitSchemePlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitAuthorizationPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitImplementationPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitPreviewPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitReviewPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), kitAdjustmentPlugin(path.resolve(KIT_ROOT,".."),path.join(__dirname,".local-analysis")), projectDiscoveryPlugin(path.resolve(KIT_ROOT,"..")), sourceReaderPlugin(path.resolve(KIT_ROOT,"../cx回收")), requirementCreatePlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")), analysisPlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")), scopePlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")),reviewPlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")),implementationPlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")),acceptancePlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")),strategyAcceptancePlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")),productionPreparationPlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis")),pageGuideAdjustmentPlugin(path.resolve(KIT_ROOT,"../cx回收"),path.join(__dirname,".local-analysis"))],
  server: {
    port: 5174,
    fs: {deny:[".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.local-analysis/**"]},
    proxy: {"/prototype-preview": {target:"http://127.0.0.1:5173",changeOrigin:false}},
  },
});
