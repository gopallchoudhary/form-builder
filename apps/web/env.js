import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    /**
     * Where the API lives *from the server*. Defaults to `NEXT_PUBLIC_API_URL`, so local
     * development needs no extra config, but a deployment can point the server at an
     * internal address while the browser keeps using the public one.
     */
    API_URL: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_API_URL: z.string().optional(),

    /**
     * The base URL that share links and QR codes are built from.
     *
     * Required, and validated as a URL, because it produces the product's main artefact: a
     * link that looks right and cannot be opened by anyone it is sent to is worse than a
     * build failure. It was `.optional()` for a while, and the share page quietly rendered
     * bare `/f/my-form` paths for every form — a bug the e2e suite passed, since its
     * assertion only checked that the string contained `/f/`.
     *
     * Note this is inlined at **build** time, not read at runtime. One bundle carries one
     * base URL, so a deployment that serves the same build on several hostnames would need
     * the origin from somewhere else. The share page falls back to `window.location.origin`
     * when this is missing, which covers local dev and a single-domain deploy; that fallback
     * is a safety net, not a substitute for setting this.
     */
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
