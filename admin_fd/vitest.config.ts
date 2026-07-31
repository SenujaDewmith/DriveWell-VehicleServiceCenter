// Deliberately separate from vite.config.ts, which used to go through a
// TanStack Start/Router codegen plugin — none of that is needed to run
// component tests, and pulling it in here made Vitest try to do file-based
// route codegen.
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
