import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { FormDefinition, QuestionDefinition } from "@repo/services/form/model";

/**
 * The builder's copy of a form.
 *
 * The store is the source of truth while the builder is open: the server is written to in
 * the background by `useAutosave`, not before every keystroke. That is what makes undo
 * possible — a server round trip per edit would make the previous state unrecoverable.
 */

export type BuilderTab = "build" | "settings" | "share" | "responses" | "analytics";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Ids minted on the client, replaced by server ids once autosave has created them. */
export const isLocalId = (id: string): boolean => id.startsWith("local:");

export interface BuilderState {
  definition: FormDefinition | null;
  /** The definition as last known to be on the server, i.e. the autosave baseline. */
  baseline: FormDefinition | null;
  selectedQuestionId: string | null;
  activeTab: BuilderTab;
  saveState: SaveState;
  past: FormDefinition[];
  future: FormDefinition[];

  hydrate: (definition: FormDefinition) => void;
  setTab: (tab: BuilderTab) => void;
  selectQuestion: (questionId: string | null) => void;
  markSaving: () => void;
  markSaved: (definition: FormDefinition) => void;
  markSaveError: () => void;

  updateSettings: (patch: Partial<FormDefinition>) => void;
  renameQuestion: (questionId: string, patch: Partial<QuestionDefinition>) => void;
  setQuestionOrder: (pageId: string | null, questionIds: string[]) => void;
  addQuestion: (question: Omit<QuestionDefinition, "id"> & { id?: string }) => string;
  removeQuestion: (questionId: string) => void;
  addPage: () => void;
  updatePage: (pageId: string, patch: { title?: string | null; description?: string | null }) => void;
  removePage: (pageId: string) => void;
  setPageOrder: (pageIds: string[]) => void;

  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 50;

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
  const commit = (update: (definition: FormDefinition) => FormDefinition) => {
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

    hydrate: (definition) =>
      set({
        definition,
        // The fetched definition *is* the persisted state, so it starts as the baseline:
        // autosave then has nothing to send until something actually changes.
        baseline: definition,
        selectedQuestionId: null,
        saveState: "idle",
        past: [],
        future: [],
      }),

    setTab: (activeTab) => set({ activeTab }),
    selectQuestion: (selectedQuestionId) => set({ selectedQuestionId }),

    markSaving: () => set({ saveState: "saving" }),
    markSaved: (definition) => set({ saveState: "saved", baseline: definition }),
    markSaveError: () => set({ saveState: "error" }),

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
      const full: QuestionDefinition = { ...question, id };

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
