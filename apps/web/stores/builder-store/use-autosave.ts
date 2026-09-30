"use client";

import { useCallback, useEffect, useRef } from "react";

import { api } from "~/trpc/api";
import { trpc } from "~/trpc/client";
import { useBuilderStore } from "~/stores/builder-store";
import { planSync } from "~/stores/builder-store/plan-sync";
import { runSync, type SyncExecutor } from "~/stores/builder-store/run-sync";

const DEBOUNCE_MS = 800;
/** How many times a rejected plan is re-attempted before the error is left to the creator. */
const RETRY_LIMIT = 3;

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
  // The running plan, if any. A promise rather than a flag, so a flush that arrives while
  // one is running can wait for it instead of dropping the edits that caused it.
  const inFlight = useRef<Promise<void> | null>(null);
  // Reset by every fresh edit, so a burst of typing is not punished by earlier failures.
  const attempts = useRef(0);

  /*
   * How the cached form list is told it is out of date, held in a ref rather than closed
   * over directly: `flush` is a `useCallback` with no dependencies, and closing over the
   * query client would rebuild it on every render and restart the debounce with it.
   */
  const utils = trpc.useUtils();
  const invalidateList = useRef<(() => void) | null>(null);
  useEffect(() => {
    invalidateList.current = () => {
      void utils.form.listForms.invalidate();
    };
  }, [utils]);

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
    /*
     * Serialised, not skipped.
     *
     * Returning early when a plan is already running looked harmless — the running plan
     * would pick the work up — but it does not: that plan was built from a definition read
     * before these edits existed. So a Publish that landed on top of an in-flight autosave
     * quietly published a form without the question the creator had just added. Waiting
     * for the running plan and then re-planning is the only version that keeps the promise
     * the publish button makes.
     */
    while (inFlight.current) await inFlight.current.catch(() => undefined);

    const store = useBuilderStore.getState();
    const current = store.definition;
    if (!current) return;

    const operations = planSync(store.baseline, current);
    if (operations.length === 0) {
      store.markSaved(current);
      return;
    }

    store.markSaving();

    const work = (async () => {
      const { definition: synced, idMap } = await runSync(current, operations, executor.current);

      /*
       * The baseline moves to what the server holds whether or not the creator has typed
       * since. The id map is folded into the live definition at the same time, because a
       * local id left on screen reads as "never created" to the next plan — and a second
       * create of the same question is refused as a duplicate, which wedged the autosave
       * for good. Edits that landed mid-request are still diffed against the new baseline
       * by the next plan, so nothing is lost by recording them as unsaved.
       */
      useBuilderStore.getState().reconcileSync(synced, idMap);

      /*
       * The list on `/forms` is rendered from the cached `listForms` query, which this
       * uncached client never touches — so a title edited in the builder stays showing the
       * old one until something refetches, and returning to the list shows a stale name.
       *
       * Scoped to `listForms` on purpose. Invalidation is a refetch, and refetching
       * `getForm` here would overwrite a definition the creator is still typing into, which
       * is the whole reason the autosave bypasses the cache.
       */
      void invalidateList.current?.();
    })();

    inFlight.current = work;

    try {
      await work;
    } catch (error) {
      // Logged, not swallowed. A silent save failure looks exactly like a builder that
      // quietly forgets work, and the plan below is what says *what* was rejected.
      console.error("autosave failed", error);
      useBuilderStore.getState().markSaveError();

      /*
       * Retry, because the most likely cause is a dropped connection rather than bad work
       * — and because the debounce only re-arms when the definition changes, a failure
       * left on its own is never attempted again. The work stays in the store untouched
       * either way, so a plan the server genuinely refuses costs nothing but the attempts.
       */
      if (attempts.current < RETRY_LIMIT) {
        attempts.current += 1;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void flush();
        }, DEBOUNCE_MS * 4);
      }
    } finally {
      inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!definition || !baseline) return;
    if (definition === baseline) return;

    if (timer.current) clearTimeout(timer.current);
    attempts.current = 0;
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
      void flush();
    };

    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [enabled, flush]);

  /**
   * Write any pending changes now, instead of in 800ms.
   *
   * Publishing has to do this, and the reason is not tidiness. The autosave is debounced,
   * so a creator who types a question and clicks Publish inside that window would otherwise
   * publish a form the server has never seen a question for — and be told, correctly but
   * bafflingly, that the form has no questions.
   */
  const flushNow = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await flush();
  }, [flush]);

  return flushNow;
}
