import { beforeEach, describe, expect, it } from "vitest";

import { useConsoleStore, INITIAL_RESPONSE_FILTERS } from "~/stores/console-store";

/**
 * The console's view preferences.
 *
 * The one that matters beyond this file is `lastFormId`. Losing it is what made a creator's
 * chosen form snap back to the newest one every time they navigated via the sidebar, because
 * the sidebar links to a bare `/responses` and the choice lived nowhere but that URL.
 */

describe("useConsoleStore", () => {
  beforeEach(() => {
    useConsoleStore.setState({
      lastFormId: null,
      lastSectionByForm: {},
      lastBuilderFormId: null,
      responsesFilters: INITIAL_RESPONSE_FILTERS,
      responsesPage: 1,
    });
  });

  it("starts with nothing chosen", () => {
    expect(useConsoleStore.getState().lastFormId).toBeNull();
  });

  it("remembers the form that was chosen", () => {
    useConsoleStore.getState().setLastForm("form-a");
    expect(useConsoleStore.getState().lastFormId).toBe("form-a");
  });

  it("clears the row-based view when the form changes", () => {
    const store = useConsoleStore.getState();
    store.setResponsesFilters({ status: "IN_PROGRESS", search: "priya", from: "", to: "" });
    store.setResponsesPage(4);

    // A page 4 of the old form's rows, filtered by a search over its answers, is meaningless
    // against a different form — and the search may not match anything there at all.
    store.setLastForm("form-b");

    const after = useConsoleStore.getState();
    expect(after.lastFormId).toBe("form-b");
    expect(after.responsesPage).toBe(1);
    expect(after.responsesFilters).toEqual(INITIAL_RESPONSE_FILTERS);
  });

  it("returns to the first page whenever the filters change", () => {
    const store = useConsoleStore.getState();
    store.setResponsesPage(7);

    // Any filter change can change which page is valid — filtering down to one page while
    // sitting on page 7 would show an empty table.
    store.setResponsesFilters({ ...INITIAL_RESPONSE_FILTERS, search: "x" });

    expect(useConsoleStore.getState().responsesPage).toBe(1);
  });

  it("keeps the form when the filters change", () => {
    const store = useConsoleStore.getState();
    store.setLastForm("form-a");
    store.setResponsesFilters({ ...INITIAL_RESPONSE_FILTERS, status: "ALL" });

    expect(useConsoleStore.getState().lastFormId).toBe("form-a");
  });

  it("leaves the page alone when only the page changes", () => {
    const store = useConsoleStore.getState();
    store.setLastForm("form-a");
    store.setResponsesPage(3);

    expect(useConsoleStore.getState().responsesPage).toBe(3);
    expect(useConsoleStore.getState().lastFormId).toBe("form-a");
  });
});

/**
 * The remembered builder section, which is what lets the form card reopen where its creator
 * left off rather than always at Build.
 */
describe("rememberSection", () => {
  beforeEach(() => {
    useConsoleStore.setState({ lastSectionByForm: {} });
  });

  it.each(["build", "settings", "share"] as const)("remembers %s", (section) => {
    useConsoleStore.getState().rememberSection("form-a", section);
    expect(useConsoleStore.getState().lastSectionByForm["form-a"]).toBe(section);
  });

  it("ignores preview, so the card cannot reopen a read-only view", () => {
    // Preview is a glance at the form rather than a place to work. Reopening a form there
    // would drop the creator into a view with no way to type, which is worse than Build.
    useConsoleStore.getState().rememberSection("form-a", "preview");
    expect(useConsoleStore.getState().lastSectionByForm["form-a"]).toBeUndefined();
  });

  it("ignores a segment that is not a real section", () => {
    // The value arrives from a URL. An unknown one must not reach the map and later produce
    // a link to a route that does not exist.
    useConsoleStore.getState().rememberSection("form-a", "responses");
    expect(useConsoleStore.getState().lastSectionByForm["form-a"]).toBeUndefined();
  });

  it("keeps one form's section out of another's", () => {
    // The reason this is keyed by form rather than held as a single value: a single value
    // gets overwritten by the second form and silently rewrites the first one's memory.
    const store = useConsoleStore.getState();
    store.rememberSection("form-a", "settings");
    store.rememberSection("form-b", "share");

    expect(useConsoleStore.getState().lastSectionByForm).toEqual({
      "form-a": "settings",
      "form-b": "share",
    });
  });

  it("replaces the object rather than mutating it", () => {
    // The persist middleware compares by reference, so an in-place write would update the
    // store and then skip the localStorage write that makes the memory survive a reload.
    const before = useConsoleStore.getState().lastSectionByForm;
    useConsoleStore.getState().rememberSection("form-a", "build");
    expect(useConsoleStore.getState().lastSectionByForm).not.toBe(before);
  });

  it("leaves the map alone when the section has not changed", () => {
    // A no-op avoids a pointless write on every render of the same tab.
    useConsoleStore.getState().rememberSection("form-a", "build");
    const after = useConsoleStore.getState().lastSectionByForm;
    useConsoleStore.getState().rememberSection("form-a", "build");
    expect(useConsoleStore.getState().lastSectionByForm).toBe(after);
  });
});

/**
 * The builder the sidebar resumes: a form and a section recorded together.
 */
describe("rememberBuilder", () => {
  beforeEach(() => {
    useConsoleStore.setState({ lastSectionByForm: {}, lastBuilderFormId: null });
  });

  it("records the form and the section in one go", () => {
    // Two separate writes could be interrupted between them, leaving the sidebar resuming a
    // form at a section it was never on.
    useConsoleStore.getState().rememberBuilder("form-a", "settings");

    const after = useConsoleStore.getState();
    expect(after.lastBuilderFormId).toBe("form-a");
    expect(after.lastSectionByForm["form-a"]).toBe("settings");
  });

  it("remembers the form most recently opened, not the first", () => {
    const store = useConsoleStore.getState();
    store.rememberBuilder("form-a", "build");
    store.rememberBuilder("form-b", "share");

    expect(useConsoleStore.getState().lastBuilderFormId).toBe("form-b");
  });

  it("treats preview as being in the form without making it the section to return to", () => {
    // Preview is read-only, so resuming into it would drop a creator somewhere they cannot
    // type. But they *are* in that form, so leaving via the sidebar should not go elsewhere.
    useConsoleStore.getState().rememberBuilder("form-a", "settings");
    useConsoleStore.getState().rememberBuilder("form-a", "preview");

    const after = useConsoleStore.getState();
    expect(after.lastBuilderFormId).toBe("form-a");
    expect(after.lastSectionByForm["form-a"]).toBe("settings");
  });

  it("ignores an unknown segment rather than storing it", () => {
    // The segment comes from a URL, so it can be anything.
    useConsoleStore.getState().rememberBuilder("form-a", "not-a-section");

    const after = useConsoleStore.getState();
    expect(after.lastBuilderFormId).toBe("form-a");
    expect(after.lastSectionByForm["form-a"]).toBeUndefined();
  });

  it("moves the remembered form when a new one is opened, keeping the old one's section", () => {
    // Each form's section is its own, so switching away and back returns to where it was.
    const store = useConsoleStore.getState();
    store.rememberBuilder("form-a", "settings");
    store.rememberBuilder("form-b", "build");
    store.rememberBuilder("form-a", "build");

    const after = useConsoleStore.getState();
    expect(after.lastBuilderFormId).toBe("form-a");
    expect(after.lastSectionByForm["form-a"]).toBe("build");
    expect(after.lastSectionByForm["form-b"]).toBe("build");
  });
});
