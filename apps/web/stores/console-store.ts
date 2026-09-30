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

  /**
   * The form whose builder was open most recently, so the sidebar can send someone back to it
   * from anywhere in the console.
   *
   * Deliberately separate from `lastFormId`. That one answers "which form am I reading across
   * all of them" and is shared by Responses and Analytics; this answers "which one was I
   * editing". A creator who is reading responses for one form and editing another has both,
   * and collapsing them into one id would make the sidebar resume whichever was touched last
   * rather than whichever was meant.
   */
  lastBuilderFormId: string | null;

  /**
   * Whether the sidebar's Forms link should resume the builder or show the list.
   *
   * Stated rather than inferred. The id above answers *which* form; this answers *whether*,
   * and the difference is the whole behaviour: a creator who opens a builder and then leaves it
   * with the back button has said they are done, and the next click on Forms must reach the
   * list. Deriving that from the current page instead meant the back button was undone by the
   * very next click, because nothing recorded the decision — only the accident of having
   * visited a builder at some point.
   *
   * Only the back button clears it. Leaving by browser back, or via the Streamyst logo, leaves
   * it set, and so still resumes: the flag records the last *deliberate* exit, not every exit.
   */
  resumeBuilder: boolean;

  responsesFilters: ResponseFilters;
  responsesPage: number;

  /** Switching form invalidates the row-based state, so both are cleared with it. */
  setLastForm: (formId: string) => void;
  setResponsesFilters: (filters: ResponseFilters) => void;
  setResponsesPage: (page: number) => void;
  /** Ignores `preview` and any unknown segment, so the map only ever holds real sections. */
  rememberSection: (formId: string, section: string) => void;
  /**
   * Record the builder currently on screen, as a form and a section together.
   *
   * One call rather than two, so `lastBuilderFormId` and the section it points at cannot be
   * written out of step and leave the sidebar resuming a form at a section it was never on.
   */
  rememberBuilder: (formId: string, segment: string) => void;
  /**
   * Record that this builder was left on purpose, so the sidebar stops resuming it.
   *
   * Leaves `lastBuilderFormId` and the per-form sections alone. The form is still the one to
   * reopen, and the list's card still lands on the right section — only the automatic redirect
   * to it is withdrawn.
   */
  leaveBuilder: () => void;
}

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set) => ({
      lastFormId: null,
      lastSectionByForm: {},
      lastBuilderFormId: null,
      resumeBuilder: false,
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

      rememberBuilder: (formId, segment) =>
        set((state) => {
          const section = isBuilderSection(segment) ? segment : null;

          /*
           * `preview` still counts as *being* in this form's builder — someone looking at it is
           * working on that form — but it is not a section to be resumed to, so the remembered
           * section is left holding whatever real section they had last. Moving between the
           * real sections of a form still updates both, so resuming lands where they left.
           *
           * `resumeBuilder` is re-asserted on every visit, so reopening a builder by any route
           * re-arms the sidebar's resume. That is why the back button has to clear it again.
           */
          /*
           * Nothing new to record, but the flag may still need raising: the back button clears
           * it, and re-entering the same form at the same section changes nothing else. Skipping
           * the write on the strength of an unchanged form and section would leave the flag off
           * for good, and the sidebar would never resume again after a single deliberate exit.
           */
          const nothingToRecord =
            !section && state.lastBuilderFormId === formId
              ? true
              : Boolean(
                  section &&
                    state.lastBuilderFormId === formId &&
                    state.lastSectionByForm[formId] === section,
                );

          if (nothingToRecord) return state.resumeBuilder ? state : { resumeBuilder: true };

          return {
            lastBuilderFormId: formId,
            resumeBuilder: true,
            ...(section ? { lastSectionByForm: { ...state.lastSectionByForm, [formId]: section } } : {}),
          };
        }),

      leaveBuilder: () => set((state) => (state.resumeBuilder ? { resumeBuilder: false } : state)),
    }),
    { name: "streamyst:console" },
  ),
);
