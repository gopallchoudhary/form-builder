import { describe, expect, it } from "vitest";

import { DEFAULT_SECTION, navHref, resolveBuilderHref } from "~/lib/builder-href";

/**
 * Where a link into the builder should point.
 *
 * The section is a route segment, so the URL is what actually decides what renders. This only
 * decides what a link points at, in the two places the URL is silent: the card on `/forms`
 * and the back-to-form link on Responses and Analytics.
 */

describe("resolveBuilderHref", () => {
  it("links to the section the creator last had open", () => {
    expect(resolveBuilderHref("form-a", "share")).toBe("/forms/form-a/share");
    expect(resolveBuilderHref("form-a", "settings")).toBe("/forms/form-a/settings");
  });

  it("falls back to build for a form with no memory", () => {
    expect(resolveBuilderHref("form-a", undefined)).toBe(`/forms/form-a/${DEFAULT_SECTION}`);
  });

  it("falls back to build rather than linking to a route that does not exist", () => {
    // The value is read back out of localStorage, so it can be anything a stale or
    // hand-edited entry holds. A link to a 404 is worse than one to the wrong-but-real tab.
    expect(resolveBuilderHref("form-a", "preview")).toBe("/forms/form-a/build");
    expect(resolveBuilderHref("form-a", "not-a-section")).toBe("/forms/form-a/build");
    expect(resolveBuilderHref("form-a", null)).toBe("/forms/form-a/build");
    expect(resolveBuilderHref("form-a", 42)).toBe("/forms/form-a/build");
  });
});

/**
 * The sidebar's Forms link, which returns to the builder rather than the list — but only while
 * the creator is still working on one.
 *
 * Two bugs live here. A static `/forms` sent a creator who was mid-edit to the list and dropped
 * the section they were on. Then, fixing that, resume followed from having *ever* visited a
 * builder, so the back button's escape was undone by the next click on Forms.
 */
describe("navHref", () => {
  it("sends Forms back to the section the creator is on", () => {
    expect(navHref("/forms", "/forms/form-a/share")).toBe("/forms/form-a/share");
    expect(navHref("/forms", "/forms/form-a/settings")).toBe("/forms/form-a/settings");
    expect(navHref("/forms", "/forms/form-a/build")).toBe("/forms/form-a/build");
  });

  it("keeps preview reachable, unlike the remembered section", () => {
    // The URL is the better record of where someone is, so the link follows it even for the
    // read-only view that the store deliberately never remembers.
    expect(navHref("/forms", "/forms/form-a/preview")).toBe("/forms/form-a/preview");
  });

  it("sends Forms to the list when not inside a builder", () => {
    // Otherwise the list becomes unreachable — the item would point at a builder from pages
    // that have no builder to point at.
    expect(navHref("/forms", "/forms")).toBe("/forms");
    expect(navHref("/forms", "/dashboard")).toBe("/forms");
    expect(navHref("/forms", "/responses")).toBe("/forms");
  });

  it("leaves every other item pointing at itself", () => {
    // Responses and Analytics are about all forms rather than one, so rewriting their urls
    // while on a builder would strand the creator in a form they were trying to step out of.
    expect(navHref("/dashboard", "/forms/form-a/share")).toBe("/dashboard");
    expect(navHref("/responses", "/forms/form-a/share")).toBe("/responses");
    expect(navHref("/analytics", "/forms/form-a/share")).toBe("/analytics");
  });

  describe("the resume flag", () => {
    /*
     * The bug this exists to fix: resume used to follow from "a builder had been visited at
     * some point", so the back button navigated to `/forms` and the very next click on Forms
     * dragged the creator straight back into the builder they had just left. The flag is what
     * the back button clears, and it is the only thing that decides.
     */

    const builder = { formId: "form-a", section: "settings" };

    it.each(["/dashboard", "/responses", "/analytics", "/forms"])(
      "resumes from %s while the flag is on",
      (path) => {
        expect(navHref("/forms", path, builder, true)).toBe("/forms/form-a/settings");
      },
    );

    it.each(["/dashboard", "/responses", "/analytics", "/forms"])(
      "shows the list from %s once the back button has cleared it",
      (path) => {
        expect(navHref("/forms", path, builder, false)).toBe("/forms");
      },
    );

    it("defaults to the list for a creator who has never left a builder", () => {
      expect(navHref("/forms", "/dashboard")).toBe("/forms");
      expect(navHref("/forms", "/dashboard", undefined, false)).toBe("/forms");
    });

    it("shows the list when the flag is on but no form was ever visited", () => {
      // The flag and the id are written by different code paths in time — a cleared form with
      // a set flag must not produce a link to `/forms/null`.
      expect(navHref("/forms", "/dashboard", { formId: null, section: "settings" }, true)).toBe(
        "/forms",
      );
    });

    it("falls back to build for a remembered section that is not real", () => {
      expect(
        navHref("/forms", "/dashboard", { formId: "form-a", section: "nonsense" }, true),
      ).toBe("/forms/form-a/build");
    });

    it("ignores the flag entirely while inside a builder", () => {
      // The url is where the creator is, so it decides — including `preview`, which is never
      // remembered, and a form the flag has nothing to do with.
      expect(navHref("/forms", "/forms/form-b/preview", builder, false)).toBe(
        "/forms/form-b/preview",
      );
    });
  });
});
