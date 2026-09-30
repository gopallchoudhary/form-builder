import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { RouterOutputs } from "@repo/trpc/client";

/**
 * The builder's copy of a form.
 *
 * The store is the source of truth while the builder is open: the server is written to in
 * the background by `useAutosave`, not before every keystroke. That is what makes undo
 * possible — a server round trip per edit would make the previous state unrecoverable.
 */

/**
 * Taken from the router rather than from the service's own `FormDefinition`, because the
 * two genuinely differ: the API has no date serialiser, so a `Date` arrives as its ISO
 * string. Typing the store with the service's shape would have had it claim `Date` fields
 * that are strings at runtime, and the lie would surface as a `new Date(undefined)` the
 * first time someone edited a close date.
 */
export type BuilderDefinition = RouterOutputs["form"]["getForm"];

/**
 * `settings` is required here, though the router's type has it optional — `z.unknown()`
 * infers an optional key. The store always holds an object, because a question with no
 * settings is stored as `{}` rather than absent, and every settings editor reads it.
 */
export type BuilderQuestion = Omit<BuilderDefinition["questions"][number], "settings"> & {
  settings: unknown;
};

/**
 * A definition as the *store* holds it, which is not quite what the router returns: a
 * question always has a `settings` object here, even when the creator has configured
 * nothing. Every settings editor reads it unguarded, so normalising it once here is what
 * keeps `settings ?? {}` out of a dozen call sites.
 */
export interface BuilderShape extends Omit<BuilderDefinition, "questions"> {
  questions: BuilderQuestion[];
}

export type BuilderTab = "build" | "settings" | "share" | "preview" | "responses" | "analytics";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Ids minted on the client, replaced by server ids once autosave has created them. */
export const isLocalId = (id: string): boolean => id.startsWith("local:");

export interface BuilderState {
  definition: BuilderShape | null;
  /** The definition as last known to be on the server, i.e. the autosave baseline. */
  baseline: BuilderShape | null;
  selectedQuestionId: string | null;
  activeTab: BuilderTab;
  saveState: SaveState;
  past: BuilderShape[];
  future: BuilderShape[];

  /**
   * Takes the router's shape and normalises it, so `settings` is guaranteed present
   * everywhere downstream. This is the one place the two shapes meet.
   */
  hydrate: (definition: BuilderDefinition) => void;
  /**
   * Empties the store, so the next form mounted re-hydrates from the server.
   *
   * The store is module-level and so outlives any page that reads it, which is what stops
   * `BuilderChrome` re-hydrating a form it already holds — and that guard is deliberate,
   * because re-hydrating is destructive: it replaces the definition *and* the baseline and
   * clears both history stacks.
   *
   * So the survival that protects a form mid-edit also means a form re-entered from the list
   * would otherwise show whatever the last visit left behind, even after the form had been
   * changed or deleted elsewhere. Calling this on the way into a builder is what separates
   * "still working on it" from "starting it fresh".
   *
   * `activeTab` is deliberately untouched: it is a UI preference, not part of the definition,
   * and there is nothing to rehydrate it from.
   */
  reset: () => void;
  setTab: (tab: BuilderTab) => void;
  selectQuestion: (questionId: string | null) => void;
  markSaving: () => void;
  markSaved: (definition: BuilderShape) => void;
  /** Folds a finished sync's baseline and its local-to-server id map into the store. */
  reconcileSync: (synced: BuilderShape, idMap: Map<string, string>) => void;
  markSaveError: () => void;

  /**
   * Switches the layout, and reconciles the questions with it.
   *
   * Going to `PAGED` is the direction that needs work: a stepper form's questions have no
   * page, so they would render on no page at all and publishing would refuse. They are
   * adopted onto the first page.
   *
   * Going to `STEP` deliberately keeps the page structure. The stepper view ignores pages,
   * so nothing is lost, and switching back restores the creator's grouping instead of
   * dumping everything onto page one.
   */
  setLayoutMode: (mode: "STEP" | "PAGED") => void;
  /**
   * Records a status the server has just accepted.
   *
   * The store holds the definition, so invalidating the query is not enough: the chip
   * reads `definition.status` and would keep saying "Draft" over a form that is genuinely
   * live, until somebody reloaded the page.
   */
  applyStatus: (status: BuilderShape["status"], publishedAt: string | null) => void;
  updateSettings: (patch: Partial<BuilderShape>) => void;
  renameQuestion: (questionId: string, patch: Partial<BuilderQuestion>) => void;
  setQuestionOrder: (pageId: string | null, questionIds: string[]) => void;
  addQuestion: (question: Omit<BuilderQuestion, "id"> & { id?: string }) => string;
  removeQuestion: (questionId: string) => void;
  addPage: () => void;
  updatePage: (pageId: string, patch: { title?: string | null; description?: string | null }) => void;
  removePage: (pageId: string) => void;
  setPageOrder: (pageIds: string[]) => void;

  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 50;

const byPosition = (a: { position: string }, b: { position: string }) =>
  Number(a.position) - Number(b.position);

/** A position that sorts after every existing one in the same group. */
function nextPosition(
  siblings: Array<{ position: string }>,
): string {
  const highest = siblings.reduce(
    (max, item) => Math.max(max, Number(item.position) || 0),
    0,
  );
  return (highest + 1).toFixed(2);
}

export const useBuilderStore = create<BuilderState>()((set, get) => {
  /**
   * Every mutation goes through here so that undo, redo and the autosave baseline are
   * impossible to forget. `commit` pushes the current definition onto the undo stack and
   * clears the redo stack, which is the standard behaviour for a linear history.
   */
  const commit = (update: (definition: BuilderShape) => BuilderShape) => {
    const { definition, past } = get();
    if (!definition) return;

    const next = update(definition);
    if (next === definition) return;

    set({
      definition: next,
      past: [...past, definition].slice(-HISTORY_LIMIT),
      future: [],
    });
  };

  return {
    definition: null,
    baseline: null,
    selectedQuestionId: null,
    activeTab: "build",
    saveState: "idle",
    past: [],
    future: [],

    hydrate: (definition) => {
      const normalised: BuilderShape = {
        ...definition,
        questions: definition.questions.map((question) => ({
          ...question,
          settings: question.settings ?? {},
        })),
      };

      set({
        definition: normalised,
        // The fetched definition *is* the persisted state, so it starts as the baseline:
        // autosave then has nothing to send until something actually changes.
        baseline: normalised,
        selectedQuestionId: null,
        saveState: "idle",
        past: [],
        future: [],
      });
    },

    reset: () =>
      set({
        definition: null,
        baseline: null,
        selectedQuestionId: null,
        saveState: "idle",
        past: [],
        future: [],
      }),

    setTab: (activeTab) => set({ activeTab }),
    selectQuestion: (selectedQuestionId) => set({ selectedQuestionId }),

    markSaving: () => set({ saveState: "saving" }),
    markSaved: (definition) => set({ saveState: "saved", baseline: definition }),

    /**
     * Records a completed sync, including the ids the server handed back.
     *
     * The baseline always moves to what the server now holds. The id map is applied to
     * whatever the creator has on screen as well, and that is the part that is easy to
     * get wrong: a local id that survives in the live definition looks like a question
     * that has never been created, so the next plan creates it a second time and the
     * server refuses it as a duplicate. Typing while a save is in flight was enough to
     * lose the map and wedge the autosave permanently.
     */
    reconcileSync: (synced, idMap) =>
      set((state) => {
        const remap = (id: string) => idMap.get(id) ?? id;
        const current = state.definition;

        if (!current) return { saveState: "saved" as const, baseline: synced };

        const remapped: BuilderShape = {
          ...current,
          pages: current.pages.map((page) => ({ ...page, id: remap(page.id) })),
          questions: current.questions.map((question) => {
            const next: BuilderQuestion = { ...question, id: remap(question.id) };
            if (question.pageId) next.pageId = remap(question.pageId);
            return next;
          }),
        };

        // Whatever changed while the plan was in flight is still unsaved against the new
        // baseline, and the next plan will pick it up. Only say "saved" when it is not.
        const dirty =
          remapped.questions.length !== synced.questions.length ||
          remapped.questions.some((question, index) => {
            const other = synced.questions[index];
            return !other || other.label !== question.label || other.kind !== question.kind;
          }) ||
          remapped.layoutMode !== synced.layoutMode ||
          remapped.title !== synced.title;

        return {
          definition: remapped,
          baseline: synced,
          // The selection has to follow the ids too, or the inspector loses the question
          // the creator is in the middle of editing the moment a save lands.
          selectedQuestionId: state.selectedQuestionId
            ? remap(state.selectedQuestionId)
            : null,
          saveState: dirty ? ("saving" as const) : ("saved" as const),
        };
      }),

    markSaveError: () => set({ saveState: "error" }),

    setLayoutMode: (mode) =>
      commit((definition) => {
        if (definition.layoutMode === mode) return definition;

        if (mode === "STEP") {
          return { ...definition, layoutMode: "STEP" };
        }

        const pages =
          definition.pages.length > 0
            ? definition.pages
            : [
                {
                  id: `local:${crypto.randomUUID()}`,
                  title: null,
                  description: null,
                  position: "1.00",
                },
              ];

        const firstPageId = [...pages].sort(byPosition)[0]?.id ?? null;

        return {
          ...definition,
          layoutMode: "PAGED",
          pages,
          questions: definition.questions.map((question) =>
            question.pageId ? question : { ...question, pageId: firstPageId },
          ),
        };
      }),

    applyStatus: (status, publishedAt) =>
      // Not a commit: a status change is not an edit, so it must not become an undo step.
      set((state) => ({
        definition: state.definition
          ? { ...state.definition, status, publishedAt }
          : state.definition,
        baseline: state.baseline
          ? { ...state.baseline, status, publishedAt }
          : state.baseline,
      })),

    updateSettings: (patch) =>
      commit((definition) => ({ ...definition, ...patch })),

    renameQuestion: (questionId, patch) =>
      commit((definition) => ({
        ...definition,
        questions: definition.questions.map((question) =>
          question.id === questionId ? { ...question, ...patch } : question,
        ),
      })),

    setQuestionOrder: (pageId, questionIds) =>
      commit((definition) => {
        const inGroup = definition.questions.filter(
          (question) => question.pageId === pageId,
        );
        const positionById = new Map(
          questionIds.map((id, index) => [id, (index + 1).toFixed(2)]),
        );

        // Questions the caller did not mention keep their relative position after the
        // ones it did, so a partial order cannot scramble the rest of the group.
        let spill = questionIds.length + 1;
        for (const question of inGroup) {
          if (!positionById.has(question.id)) {
            positionById.set(question.id, spill.toFixed(2));
            spill += 1;
          }
        }

        return {
          ...definition,
          questions: definition.questions.map((question) => {
            const position = positionById.get(question.id);
            return position ? { ...question, position } : question;
          }),
        };
      }),

    addQuestion: (question) => {
      // A local id lets the builder render and autosave the new question immediately; the
      // server replaces it with a real one once the create call returns.
      const id = question.id ?? `local:${crypto.randomUUID()}`;
      const full: BuilderQuestion = { ...question, id };

      commit((definition) => ({
        ...definition,
        questions: [
          ...definition.questions,
          {
            ...full,
            position:
              full.position ||
              nextPosition(
                definition.questions.filter(
                  (existing) => existing.pageId === full.pageId,
                ),
              ),
          },
        ],
      }));

      return id;
    },

    removeQuestion: (questionId) =>
      commit((definition) => ({
        ...definition,
        questions: definition.questions.filter((question) => question.id !== questionId),
      })),

    addPage: () =>
      commit((definition) => ({
        ...definition,
        pages: [
          ...definition.pages,
          {
            id: `local:${crypto.randomUUID()}`,
            title: null,
            description: null,
            position: nextPosition(definition.pages),
          },
        ],
      })),

    updatePage: (pageId, patch) =>
      commit((definition) => ({
        ...definition,
        pages: definition.pages.map((page) =>
          page.id === pageId ? { ...page, ...patch } : page,
        ),
      })),

    removePage: (pageId) =>
      commit((definition) => ({
        ...definition,
        pages: definition.pages.filter((page) => page.id !== pageId),
        // The questions survive the page; the service keeps them and clears `pageId`.
        questions: definition.questions.map((question) =>
          question.pageId === pageId ? { ...question, pageId: null } : question,
        ),
      })),

    setPageOrder: (pageIds) =>
      commit((definition) => {
        const positionById = new Map(
          pageIds.map((id, index) => [id, (index + 1).toFixed(2)]),
        );
        return {
          ...definition,
          pages: definition.pages.map((page) => {
            const position = positionById.get(page.id);
            return position ? { ...page, position } : page;
          }),
        };
      }),

    undo: () => {
      const { past, definition, future } = get();
      const previous = past[past.length - 1];
      if (!definition || !previous) return;

      set({
        definition: previous,
        past: past.slice(0, -1),
        future: [definition, ...future].slice(0, HISTORY_LIMIT),
      });
    },

    redo: () => {
      const { past, definition, future } = get();
      const next = future[0];
      if (!definition || !next) return;

      set({
        definition: next,
        past: [...past, definition].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      });
    },
  };
});

/** Undo and redo availability, as one value, to avoid two subscriptions re-rendering. */
export const useBuilderHistory = () =>
  useBuilderStore(useShallow((state) => ({ canUndo: state.past.length > 0, canRedo: state.future.length > 0 })));
