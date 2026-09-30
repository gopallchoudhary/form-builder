import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * What the creator was last looking at, across the console's top-level sections.
 *
 * Persisted because these are view preferences, not form data. The reasoning is the same as
 * `analytics-store`'s: nobody wants to re-pick the form and re-type the search they set up
 * thirty seconds ago, and nothing here is expensive to keep.
 */

export type StatusFilter = "COMPLETED" | "IN_PROGRESS" | "ALL";

export interface ResponseFilters {
  status: StatusFilter;
  search: string;
  from: string;
  to: string;
}

export const INITIAL_RESPONSE_FILTERS: ResponseFilters = {
  status: "COMPLETED",
  search: "",
  from: "",
  to: "",
};

/**
 * The builder sections that are worth remembering, mirroring `FormTabs`' segments.
 *
 * `preview` is deliberately absent. It is a read-only glance at the form, not a place the
 * creator works, so re-entering a form through a remembered section should never drop them
 * into a view they cannot type in. A remembered `build` is the useful default for it.
 */
export type BuilderSection = "build" | "settings" | "share";

const BUILDER_SECTIONS: readonly BuilderSection[] = ["build", "settings", "share"];

export const isBuilderSection = (value: unknown): value is BuilderSection =>
  typeof value === "string" && BUILDER_SECTIONS.includes(value as BuilderSection);

export interface ConsoleState {
  /**
   * The form the creator last looked at, shared by Responses and Analytics.
   *
   * One memory rather than one per section, because the common case is comparing the two
   * views of the *same* form: reading a response, then asking what the numbers say. Two
   * memories would drift apart within a few minutes and leave you unsure which was the
   * deliberate one.
   */
  lastFormId: string | null;

  /**
   * Which builder section the creator last had open, per form.
   *
   * Keyed per form rather than as one value, because the alternative drifts: open a second
   * form, and a single value silently rewrites what the first one is remembered as. The
   * section itself lives in the URL, so this is not where the builder decides what to render
   * — it is what lets `/forms` link back to where someone was rather than always to Build.
   */
  lastSectionByForm: Record<string, BuilderSection>;

  responsesFilters: ResponseFilters;
  responsesPage: number;

  /** Switching form invalidates the row-based state, so both are cleared with it. */
  setLastForm: (formId: string) => void;
  setResponsesFilters: (filters: ResponseFilters) => void;
  setResponsesPage: (page: number) => void;
  /** Ignores `preview` and any unknown segment, so the map only ever holds real sections. */
  rememberSection: (formId: string, section: string) => void;
}

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set) => ({
      lastFormId: null,
      lastSectionByForm: {},
      responsesFilters: INITIAL_RESPONSE_FILTERS,
      responsesPage: 1,

      setLastForm: (formId) =>
        // A page-of-5 of the previous form's rows means nothing against this one's, and a
        // search string often does not even match anything here. Both go.
        set({ lastFormId: formId, responsesFilters: INITIAL_RESPONSE_FILTERS, responsesPage: 1 }),

      setResponsesFilters: (responsesFilters) => set({ responsesFilters, responsesPage: 1 }),

      setResponsesPage: (responsesPage) => set({ responsesPage }),

      rememberSection: (formId, section) =>
        set((state) => {
          if (!isBuilderSection(section)) return state;
          if (state.lastSectionByForm[formId] === section) return state;
          // Immutable spread rather than mutation: the persist middleware compares by
          // reference, so writing into the existing object would skip the localStorage write.
          return { lastSectionByForm: { ...state.lastSectionByForm, [formId]: section } };
        }),
    }),
    { name: "streamyst:console" },
  ),
);
