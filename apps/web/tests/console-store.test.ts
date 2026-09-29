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
