import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // The browser tests build into their own directory (see `next.config.js`), so it needs the
  // same exclusion as `.next` — without it, lint walks a compiled build tree.
  { ignores: [".next-e2e/**"] },
  ...nextJsConfig,
];
