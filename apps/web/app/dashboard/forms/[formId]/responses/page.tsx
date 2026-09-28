"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { BuilderChrome } from "~/components/builder/builder-chrome";
import { ResponseFiltersBar, type ResponseFilters } from "~/components/responses/filters";
import { ResponsePagination } from "~/components/responses/pagination";
import { ResponseTable } from "~/components/responses/response-table";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { useBuilderStore } from "~/stores/builder-store";
import { useDeleteResponse, useExportCsv, useListResponses } from "~/hooks/api/response";

const PAGE_SIZE = 25;

const INITIAL_FILTERS: ResponseFilters = { status: "COMPLETED", search: "", from: "", to: "" };

/**
 * Responses, filters and export for one form.
 *
 * The question columns come from the builder store, which the chrome has already hydrated —
 * so the table's columns and the form being edited cannot disagree.
 */
function ResponsesBody() {
  const { formId } = useParams<{ formId: string }>();
  const definition = useBuilderStore((state) => state.definition);

  const [filters, setFilters] = useState<ResponseFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const { responses, total, isLoading, isFetching } = useListResponses(formId, {
    page,
    pageSize: PAGE_SIZE,
    status: filters.status,
    search: filters.search || undefined,
    // A date-only bound is the whole day, not midnight, or "to today" would silently omit
    // everything a respondent submitted this afternoon.
    from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
  });

  const { data: csv } = useExportCsv(formId);
  const { deleteResponseAsync, status: deleteStatus } = useDeleteResponse();

  const questions = [...(definition?.questions ?? [])]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((question) => ({
      id: question.id,
      label: question.label,
      labelKey: question.labelKey,
      settings: question.settings,
    }));

  const applyFilters = (next: ResponseFilters) => {
    setFilters(next);
    // Any filter change can change which page is valid, so start again from the first.
    setPage(1);
  };

  const download = () => {
    if (!csv?.csv) return;
    const url = URL.createObjectURL(new Blob([csv.csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${definition?.slug ?? "responses"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteResponseAsync({ formId, sessionId: pendingDelete });
      toast.success("Response deleted");
      setPendingDelete(null);
    } catch {
      toast.error("That response could not be deleted");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ResponseFiltersBar
          filters={filters}
          onChange={applyFilters}
          resultCount={total}
        />

        <div className="flex flex-col items-end gap-1.5">
          <Button
            variant="outline"
            onClick={download}
            disabled={!csv?.csv || (csv.csv.split("\r\n").length - 1) === 0}
          >
            <DownloadIcon className="size-4" />
            Export CSV
          </Button>
          <p className="text-muted-foreground max-w-56 text-right text-xs">
            {csv?.csv
              ? "Every response, with a column per question."
              : "Preparing the export…"}
          </p>
        </div>
      </div>

      <ResponseTable
        rows={responses ?? []}
        questions={questions}
        isLoading={isLoading}
        onDelete={setPendingDelete}
        deletingSessionId={deleteStatus === "pending" ? pendingDelete : null}
      />

      <ResponsePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total ?? 0}
        onPage={setPage}
        isFetching={isFetching}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
            <AlertDialogDescription>
              The answers are removed for good. Any totals, charts and exports will change.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // The dialog must not close on its own here: it only closes once the delete
                // has actually succeeded, so a failure leaves the choice in front of the user.
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteStatus === "pending"}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteStatus === "pending" ? "Deleting…" : "Delete response"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function FormResponsesPage() {
  const { formId } = useParams<{ formId: string }>();

  return (
    <BuilderChrome formId={formId}>
      <ResponsesBody />
    </BuilderChrome>
  );
}
