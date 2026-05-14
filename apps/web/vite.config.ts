import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@repo/shared-types": path.join(workspaceRoot, "packages/shared-types/src"),
      "@repo/validation": path.join(workspaceRoot, "packages/validation/src")
    }
  }
});