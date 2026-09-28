import globals from "globals";

import { config as baseConfig } from "./base.js";

/**
 * Flat config for the Node side of the monorepo: the API app and every server
 * package. Adds Node globals on top of the shared TypeScript rules.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "drizzle/meta/**"],
  },
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];

export default config;
