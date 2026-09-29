import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public link for a form.
 *
 * This is the string a creator pastes into a chat, and a bare `/f/my-form` looks plausible
 * enough to be mistaken for a working one — which is exactly the bug the app shipped with,
 * because the base URL was optional and silently empty.
 *
 * Two layers protect it, and they are tested separately because they are reached in
 * different circumstances:
 *
 *   1. `env.js` requires the variable, so a missing one stops the build or the process from
 *      starting at all. This is the layer that actually prevents the bug shipping.
 *   2. `publicFormUrl` falls back to `window.location.origin`, which only runs when
 *      validation was skipped — a Docker build, or a test harness that does not want to
 *      configure the world. It is a safety net, deliberately not the primary guard.
 */

const ORIGINAL_BASE = process.env.NEXT_PUBLIC_APP_URL;
const ORIGINAL_SKIP = process.env.SKIP_ENV_VALIDATION;

function setEnv(base: string | undefined, skipValidation = false) {
  if (base === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = base;

  if (skipValidation) process.env.SKIP_ENV_VALIDATION = "1";
  else delete process.env.SKIP_ENV_VALIDATION;
}

/** Imports the builder fresh, so `env` reads the environment as it is right now. */
async function builder() {
  vi.resetModules();
  return (await import("~/lib/share-url")).publicFormUrl;
}

/** A stand-in for a browser, since these tests run in node. */
function withOrigin(origin: string) {
  vi.stubGlobal("window", { location: { origin } });
}

beforeEach(() => {
  setEnv("https://forms.example.com");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();

  if (ORIGINAL_BASE === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_BASE;

  if (ORIGINAL_SKIP === undefined) delete process.env.SKIP_ENV_VALIDATION;
  else process.env.SKIP_ENV_VALIDATION = ORIGINAL_SKIP;
});

describe("publicFormUrl with the base configured", () => {
  it("builds an absolute link", async () => {
    const publicFormUrl = await builder();
    expect(publicFormUrl("customer-feedback")).toBe(
      "https://forms.example.com/f/customer-feedback",
    );
  });

  it("keeps the port, because a local base has one", async () => {
    setEnv("http://localhost:3000");
    const publicFormUrl = await builder();
    expect(publicFormUrl("x")).toBe("http://localhost:3000/f/x");
  });

  it("trims trailing slashes, so the path is not doubled", async () => {
    for (const base of ["https://forms.example.com/", "https://forms.example.com///"]) {
      setEnv(base);
      const publicFormUrl = await builder();
      expect(publicFormUrl("x"), `base: ${base}`).toBe("https://forms.example.com/f/x");
    }
  });

  it("returns nothing for an empty slug", async () => {
    const publicFormUrl = await builder();
    // `…/f/` would be the section index, not a form.
    expect(publicFormUrl("")).toBe("");
  });
});

describe("publicFormUrl with the base missing", () => {
  it("refuses to load at all, which is what stopped the bug shipping", async () => {
    setEnv(undefined);

    // The failure this whole file exists for: the app starting happily with no base URL and
    // handing out `/f/my-form`. A build-time throw is the correct outcome.
    await expect(builder()).rejects.toThrow();
  });

  it("falls back to the origin, with a warning, when validation is skipped", async () => {
    setEnv(undefined, true);
    withOrigin("https://forms.example.com");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const publicFormUrl = await builder();

    expect(publicFormUrl("my-form")).toBe("https://forms.example.com/f/my-form");
    // The warning is the point: a silent fallback would let a misconfigured production
    // instance hand out links pointing wherever it happened to be running.
    expect(warn).toHaveBeenCalled();
  });

  it("never produces a bare path, whichever layer catches it", async () => {
    setEnv(undefined, true);
    withOrigin("https://forms.example.com");

    const publicFormUrl = await builder();
    const url = publicFormUrl("my-form");

    expect(url).not.toMatch(/^\//);
    expect(url.startsWith("http")).toBe(true);
  });

  it("yields no link when skipped validation leaves no origin to use", async () => {
    // Server-side, or a test runner: no window and no configured base. Returning "" lets a
    // caller disable the control, which is honest — better than a relative path.
    setEnv(undefined, true);
    const publicFormUrl = await builder();

    expect(publicFormUrl("x")).toBe("");
  });
});
