import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only — they must not need a database or a running server.
    // Run them with `pnpm test`.
    include: ["{packages,apps}/*/tests/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
