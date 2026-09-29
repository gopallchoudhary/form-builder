"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
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
import { useBuilderStore } from "~/stores/builder-store";
import { useAutosave } from "~/stores/builder-store/use-autosave";

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
      <Badge className="gap-1.5 rounded-pill bg-[#e2f6d5] text-[#054d28]">
        <span className="size-1.5 rounded-pill bg-[#2ead4b]" />
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
        <CheckIcon className="size-3 text-[#2ead4b]" />
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

  const hydrate = useBuilderStore((state) => state.hydrate);
  const applyStatus = useBuilderStore((state) => state.applyStatus);
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
  };

  /**
   * Hydrate once per form. Keyed on the id rather than on `form`, because the query
   * refetches after a save and re-hydrating would discard edits typed since.
   */
  useEffect(() => {
    if (form && definition?.id !== form.id) hydrate(form);
  }, [form, definition?.id, hydrate]);

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
        <Button variant="outline" onClick={() => router.push("/forms")}>
          Back to forms
        </Button>
      </div>
    );
  }

  const isLive = definition.status === "PUBLISHED";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-3 sm:px-6">
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
          className="border-b border-[#d03238]/30 bg-[#d03238]/10 px-6 py-2 text-sm text-[#a7000d]"
        >
          {publishError?.message ?? "The form could not be published."}
        </p>
      )}

      <FormTabs formId={formId} onBeforeNavigate={flushAutosave} />

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
