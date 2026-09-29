"use client";

import { RotateCcwIcon, SearchIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { cn } from "~/lib/utils";

/**
 * Filters for the responses table.
 *
 * Completeness is the useful default axis: somebody checking on a form wants to know how
 * many people finished it, and who is part-way through. The date range is a plain
 * from/until pair rather than a preset menu, because "since Tuesday" is a real thing
 * somebody wants and a preset list cannot express it.
 */

// The shape lives in the store, which owns the default and persists it; the component only
// draws it.
export type { ResponseFilters, StatusFilter } from "~/stores/console-store";
import type { ResponseFilters, StatusFilter } from "~/stores/console-store";

const STATUSES: Array<{ value: StatusFilter; label: string }> = [
  { value: "COMPLETED", label: "Complete" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ALL", label: "All" },
];

/** A local `YYYY-MM-DD`, which is what a date input gives and what the API wants. */
function toInputDate(date: Date): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export function ResponseFiltersBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: ResponseFilters;
  onChange: (next: ResponseFilters) => void;
  resultCount: number | undefined;
}) {
  const patch = (next: Partial<ResponseFilters>) => onChange({ ...filters, ...next });

  const hasRange = Boolean(filters.from || filters.to);
  const isFiltered =
    filters.status !== "COMPLETED" || filters.search !== "" || hasRange;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">Completeness</Label>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Completeness">
          {STATUSES.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant="ghost"
              aria-pressed={filters.status === option.value}
              className={cn("rounded-md", filters.status === option.value && "bg-card shadow-xs")}
              onClick={() => patch({ status: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">Between</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="font-normal">
              {hasRange ? rangeLabel(filters.from, filters.to) : "Any date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={rangeFromInputs(filters.from, filters.to)}
              onSelect={(range) =>
                patch({
                  from: range?.from ? toInputDate(range.from) : "",
                  to: range?.to ? toInputDate(range.to) : "",
                })
              }
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="responses-search" className="text-muted-foreground text-xs">
          Search answers
        </Label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            id="responses-search"
            value={filters.search}
            onChange={(event) => patch({ search: event.target.value })}
            placeholder="Any answer"
            className="w-48 pl-8"
          />
        </div>
      </div>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1.5"
          onClick={() => onChange({ status: "COMPLETED", search: "", from: "", to: "" })}
        >
          <RotateCcwIcon className="size-3.5" />
          Reset
        </Button>
      )}

      {resultCount !== undefined && (
        <Badge variant="secondary" className="mb-1.5 rounded-pill">
          {resultCount} {resultCount === 1 ? "response" : "responses"}
        </Badge>
      )}
    </div>
  );
}

function rangeFromInputs(from: string, to: string) {
  if (!from && !to) return undefined;
  return {
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T00:00:00`) : undefined,
  };
}

function rangeLabel(from: string, to: string): string {
  if (from && to) return `${shortDate(from)} – ${shortDate(to)}`;
  if (from) return `From ${shortDate(from)}`;
  return `Until ${shortDate(to)}`;
}

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
