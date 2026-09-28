import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `~/*` path alias in `apps/web/tsconfig.json`, so a test inside the
      // web app can import the same way the app's own source does.
      "~": fileURLToPath(new URL("./apps/web", import.meta.url)),
    },
  },
  test: {
    // Unit tests only — they must not need a database or a running server.
    // Run them with `pnpm test`.
    include: ["{packages,apps}/*/tests/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
