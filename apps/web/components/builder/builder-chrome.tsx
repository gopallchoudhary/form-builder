"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudIcon,
  Loader2Icon,
  LockIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { FormTabs } from "~/components/form-tabs";
import { useGetForm, useGetFormSettings, useSetFormStatus } from "~/hooks/api/form";
import { trpc } from "~/trpc/client";
import { useBuilderStore } from "~/stores/builder-store";
import { useAutosave } from "~/stores/builder-store/use-autosave";
import { useConsoleStore } from "~/stores/console-store";

/**
 * The chrome every builder section shares: identity, live save state and the publish
 * action.
 *
 * It owns hydration and the autosave loop, so moving between Build, Settings, Share and
 * Preview never reloads the definition or drops unsaved edits.
 */

export function StatusChip({ status }: { status: "DRAFT" | "PUBLISHED" | "CLOSED" }) {
  if (status === "PUBLISHED") {
    return (
      <Badge className="gap-1.5 rounded-pill bg-positive-subtle text-positive-foreground">
        <span className="size-1.5 rounded-pill bg-positive" />
        Live
      </Badge>
    );
  }
  if (status === "CLOSED") {
    return <Badge variant="secondary" className="rounded-pill">Closed</Badge>;
  }
  return <Badge variant="outline" className="rounded-pill">Draft</Badge>;
}

/** What the autosave loop is doing, in the interface's own voice. */
function SaveState({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "saving") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2Icon className="size-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-destructive flex items-center gap-1.5 text-xs">
        <TriangleAlertIcon className="size-3" />
        Not saved — check your connection
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CheckIcon className="size-3 text-positive" />
        Saved
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <CloudIcon className="size-3" />
      All changes saved
    </span>
  );
}

export function BuilderChrome({
  formId,
  children,
}: {
  formId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { form, isLoading, isError, error } = useGetForm(formId);
  const { form: settings } = useGetFormSettings(formId);
  const { setFormStatusAsync, status: publishStatus, isError: publishFailed, error: publishError } =
    useSetFormStatus();

  const utils = trpc.useUtils();
  const hydrate = useBuilderStore((state) => state.hydrate);
  const applyStatus = useBuilderStore((state) => state.applyStatus);
  const leaveBuilder = useConsoleStore((state) => state.leaveBuilder);
  const definition = useBuilderStore((state) => state.definition);
  const saveState = useBuilderStore((state) => state.saveState);

  // Returns a function that writes pending changes immediately, so publish never races
  // the debounce.
  const flushAutosave = useAutosave(Boolean(definition));

  /**
   * Publish after the pending autosave has landed.
   *
   * Without the flush, a creator who adds a question and immediately clicks Publish
   * publishes a form the server has not seen a question on yet, and gets told the form has
   * no questions — true of the server, false of what is on their screen.
   */
  const publish = async (status: "PUBLISHED" | "CLOSED") => {
    await flushAutosave();

    const updated = await setFormStatusAsync({ formId, status });
    // The chip reads the store, and the store is not refetched by a mutation.
    applyStatus(updated.status, updated.publishedAt);

    // The list on `/forms` badges each card with its status, and it reads a cached query
    // that a status mutation does not touch — so without this, a form published here still
    // reads Draft back on the list until a manual reload.
    await utils.form.listForms.invalidate();
  };

  /**
   * Hydrate once per mount, and again only when the form itself changes.
   *
   * Keyed on the id rather than on `form` alone, because the query refetches after a save
   * and re-hydrating then would discard edits typed since. But keying on the id *alone* was
   * too strong in the other direction: the store outlives the page, so reopening a form the
   * creator had already loaded matched `definition?.id === form.id`, skipped hydration
   * entirely, and rendered whatever the previous visit left behind — stale questions, a
   * stale status, and a stale undo stack, even after the form had been changed or deleted
   * elsewhere. Tracking the id we hydrated for, once per mount, separates the two cases.
   */
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!form) return;
    if (hydratedFor.current === form.id) return;
    hydratedFor.current = form.id;
    hydrate(form);
  }, [form, hydrate]);

  if (isLoading || !definition) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlertIcon className="text-destructive size-6" />
        <p className="font-medium">This form could not be opened</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {error?.message ?? "It may have been deleted, or it is not yours."}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            /*
             * Also here, and for a stronger reason. This form is gone, so a resume flag left
             * set would keep pointing the sidebar's Forms link at a builder that cannot load —
             * and this screen is where that link would land, so the creator could not click
             * their way out of it.
             */
            leaveBuilder();
            router.push("/forms");
          }}
        >
          Back to forms
        </Button>
      </div>
    );
  }

  const isLive = definition.status === "PUBLISHED";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-3 sm:px-6">
        {/*
          The way out of the builder, and the only one that is a real escape.

          The sidebar's Forms link resumes the builder rather than showing the list, which is
          what makes coming back cheap but leaves "show me all my forms" with no obvious
          target. This is that: one click, from every section, and it does not depend on
          anything having been remembered.

          `shrink-0` so it stays put on a narrow screen. The header wraps, and the title is
          `flex-1`, so without this the button would wrap onto a line of its own and read as
          an orphan rather than as part of the header.
        */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-muted-foreground -ml-2 shrink-0"
        >
          <Link
            href="/forms"
            aria-label="Back to all forms"
            onClick={(event) => {
              // Same reasoning as the tab strip, and the same trap: the autosave is debounced,
              // and a request started while the page unloads is aborted, so a creator who
              // typed a question and left would lose it. A plain link would do exactly that.
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }

              event.preventDefault();

              /*
               * Cleared before the flush, not after: the flush is awaited, and if it rejects the
               * navigation still happens — so clearing afterwards would leave the flag set on
               * exactly the path where the creator was told nothing worked.
               *
               * A deliberate exit is the one thing that should stop the sidebar resuming, and
               * this is the only place a creator can say so from inside a builder.
               */
              leaveBuilder();
              void flushAutosave().finally(() => router.push("/forms"));
            }}
          >
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight">
            {definition.title}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <SaveState state={saveState} />
            {settings?.passwordProtected && (
              <span className="flex items-center gap-1">
                <LockIcon className="size-3" />
                Password protected
              </span>
            )}
          </div>
        </div>

        <StatusChip status={definition.status} />

        {/*
          The way out to the two sections, with the form already chosen.

          They are not tabs any more, so without this a creator who has just published would
          have to leave the form, find the section, and pick the form again to ask the
          obvious next question.

          Named "View …" rather than repeating the section's own name: the sidebar carries a
          link called "Responses" on this very page, and two links with the same label to the
          same place tell a screen-reader user nothing about which is which.
        */}
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/responses?form=${formId}`}>View responses</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/analytics?form=${formId}`}>View analytics</Link>
          </Button>
        </div>

        {isLive ? (
          <Button
            variant="outline"
            onClick={() => void publish("CLOSED")}
            disabled={publishStatus === "pending"}
          >
            Close form
          </Button>
        ) : (
          <Button
            onClick={() => void publish("PUBLISHED")}
            disabled={publishStatus === "pending"}
          >
            {publishStatus === "pending" ? "Publishing…" : "Publish"}
          </Button>
        )}
      </header>

      {publishFailed && (
        <p
          role="alert"
          // `--destructive` rather than three hand-tuned hexes: `#a7000d` over `#d03238` at 10%
          // is a dark red on pale red, which only reads against a light page. The token is
          // lightened in `.dark`, so the same classes hold on either canvas.
          className="border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive"
        >
          {publishError?.message ?? "The form could not be published."}
        </p>
      )}

      <FormTabs formId={formId} onBeforeNavigate={flushAutosave} />

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
