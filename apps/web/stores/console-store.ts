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

  responsesFilters: ResponseFilters;
  responsesPage: number;

  /** Switching form invalidates the row-based state, so both are cleared with it. */
  setLastForm: (formId: string) => void;
  setResponsesFilters: (filters: ResponseFilters) => void;
  setResponsesPage: (page: number) => void;
}

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set) => ({
      lastFormId: null,
      responsesFilters: INITIAL_RESPONSE_FILTERS,
      responsesPage: 1,

      setLastForm: (formId) =>
        // A page-of-5 of the previous form's rows means nothing against this one's, and a
        // search string often does not even match anything here. Both go.
        set({ lastFormId: formId, responsesFilters: INITIAL_RESPONSE_FILTERS, responsesPage: 1 }),

      setResponsesFilters: (responsesFilters) => set({ responsesFilters, responsesPage: 1 }),

      setResponsesPage: (responsesPage) => set({ responsesPage }),
    }),
    { name: "streamyst:console" },
  ),
);
