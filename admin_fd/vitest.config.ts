// Deliberately separate from vite.config.ts, which goes through
// @lovable.dev/vite-tanstack-config (TanStack Start/Router codegen, Cloudflare
// build plugin, etc.) — none of that is needed to run component tests, and
// pulling it in here makes Vitest try to do file-based route codegen.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
