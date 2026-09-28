"use client";

import { useCallback, useEffect, useRef } from "react";

import { api } from "~/trpc/api";
import { useBuilderStore } from "~/stores/builder-store";
import { planSync } from "~/stores/builder-store/plan-sync";
import { runSync, type SyncExecutor } from "~/stores/builder-store/run-sync";

const DEBOUNCE_MS = 800;

/**
 * Writes the builder store's definition to the server, debounced.
 *
 * The alternative — calling a mutation per keystroke — would make every character a
 * round trip and would leave the store fighting the response cache, since a late response
 * could carry a version older than what the builder is now showing.
 *
 * The store's `baseline` is the contract that makes this safe: the plan is a diff against
 * the last state the server is known to hold, so a burst of edits collapses into the few
 * calls that actually change something.
 */
export function useAutosave(enabled = true) {
  const definition = useBuilderStore((state) => state.definition);
  const baseline = useBuilderStore((state) => state.baseline);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against two plans running at once, which would interleave their writes.
  const inFlight = useRef(false);

  // The uncached `api` client, not the React Query one: the store is the source of truth
  // here, and a cache invalidation would refetch a definition the builder is mid-edit on.
  const executor = useRef<SyncExecutor>({
    updateSettings: (input) => api.form.updateFormSettings.mutate(input),
    createPage: (input) => api.formPage.createPage.mutate(input),
    updatePage: (input) => api.formPage.updatePage.mutate(input),
    deletePage: (input) => api.formPage.deletePage.mutate(input),
    reorderPages: (input) => api.formPage.reorderPages.mutate(input),
    createQuestion: (input) => api.question.createQuestion.mutate(input),
    updateQuestion: (input) => api.question.updateQuestion.mutate(input),
    deleteQuestion: (input) => api.question.deleteQuestion.mutate(input),
    reorderQuestions: (input) => api.question.reorderQuestions.mutate(input),
  });

  const flush = useCallback(async () => {
    if (inFlight.current) return;

    const store = useBuilderStore.getState();
    const current = store.definition;
    if (!current) return;

    const operations = planSync(store.baseline, current);
    if (operations.length === 0) {
      store.markSaved(current);
      return;
    }

    inFlight.current = true;
    store.markSaving();

    try {
      const { definition: synced } = await runSync(current, operations, executor.current);

      // Only promote the baseline if the store has not moved on since this plan was
      // built. If it has, those newer edits are still unsaved and the next plan will
      // pick them up — promoting blindly would mark them as persisted.
      if (useBuilderStore.getState().definition === current) {
        useBuilderStore.getState().markSaved(synced);
      }
    } catch {
      useBuilderStore.getState().markSaveError();
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!definition || !baseline) return;
    if (definition === baseline) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, definition, baseline, flush]);

  // A pending debounce must not be lost to a navigation, so it is flushed on unload.
  useEffect(() => {
    if (!enabled) return;

    const onHide = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    };

    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [enabled, flush]);
}
