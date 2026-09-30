import { beforeEach, describe, expect, it } from "vitest";

import { useBuilderStore, type BuilderShape } from "~/stores/builder-store";

/**
 * `reset()` — the store's "this form is starting fresh" signal.
 *
 * The store is module-level and so outlives every page that reads it, which is what lets
 * `BuilderChrome` skip re-hydrating a form it already holds. That protection is what stops a
 * tab switch from discarding unsaved work, so it cannot simply be removed; `reset()` is the
 * deliberate opt-out, and these tests pin what it does and — more importantly — what it must
 * leave alone.
 */

function form(overrides: Partial<BuilderShape> = {}): BuilderShape {
  return {
    id: "form-a",
    slug: "hiring",
    title: "Hiring",
    description: null,
    layoutMode: "STEP",
    themeKey: "sage",
    status: "DRAFT",
    showProgress: true,
    allowBack: true,
    oneResponsePerDevice: false,
    maxResponses: null,
    closesAt: null,
    thankYouTitle: null,
    thankYouMessage: null,
    thankYouRedirectUrl: null,
    version: 1,
    publishedAt: null,
    createdAt: null,
    updatedAt: null,
    pages: [],
    questions: [],
    ...overrides,
  };
}

const MINIMAL = form();

/** The other form, used to prove a reset lets a *different* form through afterwards. */
const OTHER = form({ id: "form-b", slug: "other" });

describe("builder store reset", () => {
  beforeEach(() => {
    useBuilderStore.getState().reset();
    useBuilderStore.setState({ activeTab: "share" });
  });

  it("empties the store, so the next form mounted re-hydrates", () => {
    const store = useBuilderStore.getState();
    store.hydrate(MINIMAL);
    store.updateSettings({ title: "Renamed" });
    store.selectQuestion("q1");

    // Precondition: there is something to clear. Without it the assertions below would pass
    // against a store that was never populated.
    expect(useBuilderStore.getState().definition).not.toBeNull();
    expect(useBuilderStore.getState().definition?.title).toBe("Renamed");

    useBuilderStore.getState().reset();

    const after = useBuilderStore.getState();
    expect(after.definition).toBeNull();
    expect(after.baseline).toBeNull();
    expect(after.selectedQuestionId).toBeNull();
    expect(after.saveState).toBe("idle");
  });

  it("clears the undo history, which would otherwise undo into a different form", () => {
    const store = useBuilderStore.getState();
    store.hydrate(MINIMAL);
    store.updateSettings({ title: "One" });
    store.updateSettings({ title: "Two" });

    expect(useBuilderStore.getState().past.length).toBeGreaterThan(0);

    useBuilderStore.getState().reset();

    // `past` holds whole definitions from this form. Carried into the next one, a single undo
    // would replace the new form's questions with this form's.
    const after = useBuilderStore.getState();
    expect(after.past).toEqual([]);
    expect(after.future).toEqual([]);
  });

  it("leaves activeTab alone, because it is a preference rather than form data", () => {
    // There is no form to rehydrate it from, and clobbering it would drop the creator's tab
    // choice for a reason that has nothing to do with the form.
    useBuilderStore.getState().setTab("settings");
    useBuilderStore.getState().reset();

    expect(useBuilderStore.getState().activeTab).toBe("settings");
  });

  it("lets the next form hydrate cleanly", () => {
    // The point of the whole operation: a null definition is what makes the guard in
    // `BuilderChrome` compare unequal and hydrate rather than keeping the old form.
    const store = useBuilderStore.getState();
    store.hydrate(MINIMAL);
    store.selectQuestion("q1");

    useBuilderStore.getState().reset();
    useBuilderStore.getState().hydrate(OTHER);

    const after = useBuilderStore.getState();
    expect(after.definition?.id).toBe("form-b");
    expect(after.selectedQuestionId).toBeNull();
    expect(after.baseline?.id).toBe("form-b");
  });

  it("is safe to call on an already-empty store", () => {
    useBuilderStore.getState().reset();
    expect(() => useBuilderStore.getState().reset()).not.toThrow();
    expect(useBuilderStore.getState().definition).toBeNull();
  });
});
