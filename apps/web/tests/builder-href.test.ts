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
 * The sidebar's Forms link, which returns to the builder rather than the list.
 *
 * This was the actual bug: a static `/forms` sent a creator who was mid-edit to the list and
 * dropped the section they were on, so the remembered-section work in `console-store` was
 * never consulted at all.
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

  describe("once stepped away from the builder", () => {
    // Responses and Analytics take a form in `?form=` and have no notion of a builder, so the
    // url says nothing about which form was being edited. The remembered builder is the only
    // thing that can answer, and without it Forms dumps a creator mid-project on the list.
    it("resumes the remembered form and section", () => {
      expect(
        navHref("/forms", "/responses?form=form-a", { formId: "form-a", section: "settings" }),
      ).toBe("/forms/form-a/settings");
    });

    it("prefers the remembered section over the form someone is reading", () => {
      // `lastFormId` and `lastBuilderFormId` are deliberately separate: reading responses for
      // one form while editing another is a normal thing to be doing.
      expect(
        navHref("/forms", "/responses?form=form-b", { formId: "form-a", section: "share" }),
      ).toBe("/forms/form-a/share");
    });

    it("falls back to build for a remembered section that is not real", () => {
      expect(
        navHref("/forms", "/dashboard", { formId: "form-a", section: "nonsense" }),
      ).toBe("/forms/form-a/build");
    });

    it("shows the list when no builder has been opened", () => {
      // Otherwise Forms would have no list destination at all for a first-time creator.
      expect(navHref("/forms", "/dashboard")).toBe("/forms");
      expect(navHref("/forms", "/dashboard", { formId: null, section: undefined })).toBe("/forms");
    });

    it("lets the live url beat the memory", () => {
      // Already inside a builder, the url is where the creator is; the memory may be older.
      expect(
        navHref("/forms", "/forms/form-b/preview", { formId: "form-a", section: "settings" }),
      ).toBe("/forms/form-b/preview");
    });
  });
});
