import { describe, expect, it } from "vitest";

import { nextThemeFor } from "~/lib/theme";

/**
 * Which theme a click on the sidebar toggle leads to.
 *
 * The important part is not the arithmetic, it is that this is a pure function at all. The
 * toggle itself is a component, and this repo's Vitest runs in a node environment with no
 * Testing Library — so the decision the button makes is extracted and tested here, and only
 * the rendering is left unverified.
 */

describe("nextThemeFor", () => {
  it("offers light while dark is in effect", () => {
    expect(nextThemeFor("dark")).toBe("light");
  });

  it("offers dark while light is in effect", () => {
    expect(nextThemeFor("light")).toBe("dark");
  });

  it("offers dark when the theme is not yet known", () => {
    // `resolvedTheme` is undefined on the server and on the first client render, before the
    // provider has read storage. The button still needs a target, and dark is the default the
    // app ships with — so a first click lands in the theme the creator was going to see anyway.
    expect(nextThemeFor(undefined)).toBe("dark");
  });

  it("offers dark for a value it does not recognise", () => {
    // `system` used to reach this far while `enableSystem` was on. It is off now, but the
    // guard is the difference between a working toggle and a button that silently does
    // nothing if a value like that ever comes back.
    expect(nextThemeFor("system")).toBe("dark");
    expect(nextThemeFor("")).toBe("dark");
  });

  it("always offers something, so the toggle can never be a no-op", () => {
    for (const value of ["dark", "light", "system", "", undefined]) {
      expect(["light", "dark"]).toContain(nextThemeFor(value));
    }
  });
});