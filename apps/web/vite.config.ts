import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function devCacheBypass(): Plugin {
  return {
    name: "dev-cache-bypass",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/sw.js") {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(
            'self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));'
          );
          return;
        }

        res.setHeader("Cache-Control", "no-store");
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), devCacheBypass()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store"
    },
    watch: {
      usePolling: true,
      interval: 100
    },
    hmr: true
  },
  resolve: {
    alias: {
      "@repo/shared-types": path.join(workspaceRoot, "packages/shared-types/src"),
      "@repo/validation": path.join(workspaceRoot, "packages/validation/src")
    }
  }
});
