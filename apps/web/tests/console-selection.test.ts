import { describe, expect, it } from "vitest";

import { mostRecentlyUpdated, resolveSelectedForm } from "~/lib/console-selection";

/**
 * Which form a console section shows.
 *
 * The rule has three sources and an order, and the order is the behaviour: a link somebody
 * was sent beats what you last looked at, which beats a guess. The bug this pins down was
 * the missing middle step — leaving via the sidebar drops `?form=`, and with nothing to fall
 * back to, every return visit showed the newest form instead of the one you had chosen.
 */

const OLDER = "11111111-1111-4111-8111-111111111111";
const NEWER = "22222222-2222-4222-8222-222222222222";

const forms = [
  { id: OLDER, updatedAt: "2024-01-01T00:00:00.000Z" },
  { id: NEWER, updatedAt: "2024-06-01T00:00:00.000Z" },
];

describe("mostRecentlyUpdated", () => {
  it("picks the newest by updatedAt, not by list order", () => {
    expect(mostRecentlyUpdated(forms)).toBe(NEWER);
    expect(mostRecentlyUpdated([...forms].reverse())).toBe(NEWER);
  });

  it("has nothing to offer with no forms", () => {
    expect(mostRecentlyUpdated([])).toBeNull();
  });

  it("treats a form with no timestamp as the oldest, not the newest", () => {
    // `new Date(null)` is the epoch, so a missing date must not sort as "most recent" —
    // otherwise every undated form would outrank every dated one.
    expect(mostRecentlyUpdated([{ id: OLDER, updatedAt: null }, forms[1]!])).toBe(NEWER);
  });
});

describe("resolveSelectedForm", () => {
  it("prefers a form given in the URL over everything remembered", () => {
    expect(resolveSelectedForm({ fromUrl: OLDER, remembered: NEWER, forms })).toEqual({
      selected: OLDER,
      stale: false,
    });
  });

  it("falls back to the remembered form when the URL says nothing", () => {
    // This is the round trip: arriving from the sidebar, with no `?form=` at all.
    expect(resolveSelectedForm({ fromUrl: null, remembered: OLDER, forms })).toEqual({
      selected: OLDER,
      stale: false,
    });
  });

  it("falls back to the most recently updated form on a first visit", () => {
    expect(resolveSelectedForm({ fromUrl: null, remembered: null, forms })).toEqual({
      selected: NEWER,
      stale: false,
    });
  });

  it("does not report a first visit as a problem", () => {
    // Nothing was asked for and nothing was lost, so there is nothing to say to the creator.
    const { stale } = resolveSelectedForm({ fromUrl: null, remembered: null, forms });
    expect(stale).toBe(false);
  });

  it("reports a stale link, and falls through to the newest form", () => {
    // A form deleted, or an id from another account. Fetching it would render a table and
    // charts that are permanently empty, indistinguishable from "nobody has answered yet".
    const result = resolveSelectedForm({ fromUrl: "deleted-id", remembered: null, forms });

    expect(result.selected).toBe(NEWER);
    expect(result.stale).toBe(true);
  });

  it("reports a remembered form that has since been deleted", () => {
    const result = resolveSelectedForm({ fromUrl: null, remembered: "deleted-id", forms });

    expect(result.selected).toBe(NEWER);
    expect(result.stale).toBe(true);
  });

  it("prefers a stale URL over a live memory, and still says so", () => {
    // The link is what the creator was sent, so it is what they see — but they deserve to
    // know the remembered form is the one still there.
    const result = resolveSelectedForm({ fromUrl: "deleted-id", remembered: OLDER, forms });

    expect(result.selected).toBe(OLDER);
    expect(result.stale).toBe(false);
  });

  it("selects nothing when there are no forms at all", () => {
    // Distinct from "stale": there is nothing wrong, there is simply nothing to show, and
    // the page's own empty state handles it.
    expect(resolveSelectedForm({ fromUrl: OLDER, remembered: OLDER, forms: [] })).toEqual({
      selected: null,
      stale: false,
    });
  });
});
