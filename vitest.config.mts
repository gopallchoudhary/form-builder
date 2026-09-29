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

    /*
     * The 10s default is not enough for a `beforeAll` that stands up a database.
     *
     * PGlite compiles Postgres to WebAssembly on first use, and the API suite imports the
     * whole server after pointing it at a throwaway database. Both are ordinary work that
     * simply cannot finish in ten seconds on a cold start — and a hook that times out
     * reports as *skipped tests*, so the suite goes quietly green while proving nothing.
     * That is the worst possible failure mode, and it is what this default produced.
     */
    hookTimeout: 120_000,
  },
});
