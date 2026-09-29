import { describe, expect, it } from "vitest";

import { isNavItemActive } from "~/lib/nav";

/**
 * The sidebar's highlight.
 *
 * The bug these pin down was a sidebar where every item was lit on every page, because
 * `/dashboard` was a prefix of `/dashboard/forms`. No assertion about markup can catch that;
 * the rule itself is what has to be right.
 */

  const NAV = ["/dashboard", "/forms", "/responses", "/analytics"] as const;

const active = (pathname: string, urls: readonly string[] = NAV) =>
  urls.filter((url) => isNavItemActive(pathname, urls, url));

describe("isNavItemActive", () => {
  it("lights the section you are in, and only that one", () => {
    expect(active("/dashboard")).toEqual(["/dashboard"]);
    expect(active("/forms")).toEqual(["/forms"]);
  });

  it("keeps the section lit on its nested pages", () => {
    for (const path of [
      "/forms/abc/build",
      "/forms/abc/share",
      "/forms/abc/settings",
      "/forms/abc/responses",
      "/forms/abc/preview",
      "/forms/abc/analytics",
    ]) {
      expect(active(path)).toEqual(["/forms"]);
    }
  });

  it("stands a parent down while a child owns the route", () => {
    // The shape that broke it: a parent that is also a prefix of a sibling item.
    const nested = ["/console", "/console/forms", "/console/settings"];

    expect(active("/console/forms", nested)).toEqual(["/console/forms"]);
    expect(active("/console/settings", nested)).toEqual(["/console/settings"]);
    // With no child matching, the parent still owns the route.
    expect(active("/console/billing", nested)).toEqual(["/console"]);
    expect(active("/console", nested)).toEqual(["/console"]);
  });

  it("matches whole segments, not string prefixes", () => {
    // `/dashboard-archive` starts with the characters of `/dashboard` but is a different
    // route, and a substring test would light the wrong item.
    expect(active("/dashboard-archive")).toEqual([]);
    expect(active("/forms-archive")).toEqual([]);
  });

  it("lights nothing for a route it does not own", () => {
    expect(active("/login")).toEqual([]);
    expect(active("/")).toEqual([]);
  });

  it("gives each section its own entry, with the form in the query", () => {
    // `/responses` and `/analytics` carry the form in `?form=`, not in the path, so these are
    // exact matches and neither can steal the other's highlight.
    expect(active("/responses")).toEqual(["/responses"]);
    expect(active("/analytics")).toEqual(["/analytics"]);

    /*
     * A nested path under one of them still lights it.
     *
     * This is the one case the rule has to get right without help: there is no descendant
     * entry to defer to, so the section keeps the highlight. Today nothing nests under
     * `/responses`, but `/responses/<id>` is the obvious next shape and a section that went
     * dark the moment it gained a sub-page would be a nasty surprise.
     */
    expect(active("/responses/anything")).toEqual(["/responses"]);
    expect(active("/analytics/anything/deeper")).toEqual(["/analytics"]);

    // A near-miss sibling shares a prefix but is a different route.
    expect(active("/responses-archive")).toEqual([]);
  });
});
