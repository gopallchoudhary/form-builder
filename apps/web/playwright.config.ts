import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a real API and a real Postgres, because the things worth
 * testing here are exactly the things a mock hides: a cookie that is not forwarded, a
 * session that does not resume, a publish gate that accepts a half-finished form.
 *
 * The API and the web app are started by Playwright itself, so a run needs no manual setup
 * beyond a migrated database.
 */
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100); // eslint-disable-line turbo/no-undeclared-env-vars
const API_PORT = Number(process.env.E2E_API_PORT ?? 8100); // eslint-disable-line turbo/no-undeclared-env-vars

export default defineConfig({
  testDir: "./e2e",
  // The API's rate limit is keyed on the client IP, and every test here comes from the
  // same one, so a serial run is the difference between passing and being throttled.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "pnpm --filter @repo/api dev",
      url: `http://localhost:${API_PORT}/openapi.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        // The browser talks to the API cross-origin, so the API has to be told this run's
        // web origin is allowed. Without it every client-side mutation is blocked by CORS
        // and the tests fail for a reason that has nothing to do with the product.
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        /*
         * A whole suite in a few minutes is hundreds of calls from one address, and the
         * limiter counts by IP. Left at the default it started refusing requests part-way
         * through a run, which looked exactly like the product losing writes — the same
         * evidence a real rate-limit bug would produce, and just as misleading.
         */
        RATE_LIMIT_MAX: "100000",
      },
    },
    {
      command: "pnpm --filter web dev",
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(WEB_PORT),
        // Its own build directory, so this dev server does not contend for the lock with a
        // developer's `pnpm dev` and the suite can run without stopping it.
        NEXT_DIST_DIR: ".next-e2e",
        // The browser talks to the API through `NEXT_PUBLIC_API_URL` and the server
        // components through `API_URL`; both have to point at *this run's* API, not at
        // whatever a developer happens to have on 8000.
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/trpc`,
        API_URL: `http://localhost:${API_PORT}/trpc`,
      },
    },
  ],
});
