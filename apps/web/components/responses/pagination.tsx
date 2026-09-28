"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

/**
 * Page controls for the responses table.
 *
 * The count shown is the *total across all pages*, not the size of the current page, so
 * "showing 11–20 of 143" cannot be misread as the whole story.
 */
export function ResponsePagination({
  page,
  pageSize,
  total,
  onPage,
  isFetching,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  isFetching?: boolean;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {isFetching ? "Loading…" : `Showing ${first}–${last} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1 || isFetching}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeftIcon className="size-3.5" />
          Previous
        </Button>

        <p className="text-muted-foreground px-1 text-sm">
          Page {page} of {pageCount}
        </p>

        <Button
          size="sm"
          variant="outline"
          disabled={page >= pageCount || isFetching}
          onClick={() => onPage(page + 1)}
        >
          Next
          <ChevronRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
