"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

import { BuilderChrome } from "~/components/builder/builder-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useExportCsv, useListResponses } from "~/hooks/api/response";

/**
 * A plain response list.
 *
 * The `data-table` treatment, per-question answer rendering, completeness filters and
 * pagination controls are the responses phase. What is here now is the real query and the
 * real CSV export.
 */
function ResponsesBody() {
  const { formId } = useParams<{ formId: string }>();
  const [search, setSearch] = useState("");

  const { responses, total, isLoading } = useListResponses(formId, {
    search: search || undefined,
  });
  const { data: csv } = useExportCsv(formId);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {total === undefined ? "—" : `${total} completed`}
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search answers"
            aria-label="Search answers"
            className="w-48"
          />
          <Button
            variant="outline"
            disabled={!csv?.csv}
            onClick={() => {
              if (!csv?.csv) return;
              const url = URL.createObjectURL(new Blob([csv.csv], { type: "text/csv" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = `responses-${formId}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {responses && responses.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card/60 py-16 text-center">
          <p className="text-sm font-medium">No responses yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Share the form and responses will appear here.
          </p>
        </div>
      )}

      {responses && responses.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Responses to this form</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Started
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Duration
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Answers
                </th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response) => (
                <tr key={response.sessionId} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary">{response.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {new Date(response.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {response.durationSeconds === null ? "—" : `${response.durationSeconds}s`}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {response.answers.length} answered
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
