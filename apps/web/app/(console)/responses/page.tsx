"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { FormPicker, useSelectedForm } from "~/components/console/form-picker";
import { SectionHeader } from "~/components/console/section-header";
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
import { useGetForm } from "~/hooks/api/form";
import { useDeleteResponse, useExportCsv, useListResponses } from "~/hooks/api/response";

const PAGE_SIZE = 25;

const INITIAL_FILTERS: ResponseFilters = { status: "COMPLETED", search: "", from: "", to: "" };

/**
 * Responses, for one form, across every form the creator owns.
 *
 * A section rather than a form's sixth tab: a creator comes here to see what came in, and
 * the form they mean is a question, not part of the address.
 *
 * The question columns come from `getForm` rather than the builder store. That store exists
 * to hold edits the server has not seen yet, and a read-only table has no business hydrating
 * one — it is the reason the builder store is now read only by the builder itself.
 */
export default function ResponsesPage() {
  const { selected, select, forms = [], isLoading } = useSelectedForm();
  const formId = selected;

  const [filters, setFilters] = useState<ResponseFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const { form } = useGetForm(formId);
  const { responses, total, isLoading: loadingResponses, isFetching } = useListResponses(formId, {
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

  const questions = [...(form?.questions ?? [])]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((question) => ({
      id: question.id,
      label: question.label,
      labelKey: question.labelKey,
      settings: question.settings,
    }));

  // Changing form invalidates the page, the filters' result count and any pending delete.
  const applyFilters = (next: ResponseFilters) => {
    setFilters(next);
    setPage(1);
  };

  const onSelect = (nextId: string) => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
    setPendingDelete(null);
    select(nextId);
  };

  const download = () => {
    if (!csv?.csv) return;
    const url = URL.createObjectURL(new Blob([csv.csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${form?.slug ?? "responses"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !formId) return;
    try {
      await deleteResponseAsync({ formId, sessionId: pendingDelete });
      toast.success("Response deleted");
      setPendingDelete(null);
    } catch {
      // Left to the page: the dialog stays open so the choice is still in front of them.
      toast.error("That response could not be deleted");
    }
  };

  if (forms.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <SectionHeader
          formId={null}
          title="Responses"
          description="Everything people have sent you."
        />
        <p className="text-muted-foreground text-sm">
          Once you have a form and share its link, the answers land here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <SectionHeader
        formId={formId}
        title="Responses"
        description={
          formId
            ? `Everything people have sent for ${form?.title ?? "this form"}.`
            : "Everything people have sent you."
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormPicker value={formId} onChange={onSelect} />
      </div>

      {formId && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ResponseFiltersBar filters={filters} onChange={applyFilters} resultCount={total} />

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
                {csv?.csv ? "Every response, with a column per question." : "Preparing the export…"}
              </p>
            </div>
          </div>

          <ResponseTable
            rows={responses ?? []}
            questions={questions}
            isLoading={loadingResponses}
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
        </>
      )}

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
