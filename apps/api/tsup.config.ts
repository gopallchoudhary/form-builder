import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts", "./src/migrate.ts"],
  splitting: false,
  bundle: true,
  /*
   * Workspace packages are TypeScript source, not published packages with a `main` field.
   * Leaving them external produced a dist that required `@repo/trpc/server` at runtime and
   * failed inside a clean container; bundling them keeps the image self-contained.
   */
  noExternal: [/^@repo\//],
  outDir: "./dist",
  clean: true,
  env: { IS_SERVER_BUILD: "true" },
  loader: { ".json": "copy" },
  minify: true,
  // Keep stack traces readable in production; the payload is not cacheable anyway.
  sourcemap: true,
});
