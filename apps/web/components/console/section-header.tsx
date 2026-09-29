"use client";

import Link from "next/link";
import { SquarePenIcon } from "lucide-react";

import { StatusChip } from "~/components/builder/builder-chrome";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetForm } from "~/hooks/api/form";

/**
 * The header on a top-level section: which form, and how to get back to editing it.
 *
 * There is deliberately no Publish button here. The builder owns that control, and two
 * places claiming to know whether a form is live is how they come to disagree — the same
 * reason the per-form analytics and responses pages used to sit inside the builder chrome
 * rather than beside it.
 */
export function SectionHeader({
  formId,
  title,
  description,
}: {
  formId: string | null;
  title: string;
  description: string;
}) {
  // The definition, not the list entry: the picker already knows the title, and the two can
  // differ for a moment after a rename.
  const { form } = useGetForm(formId);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {form ? <StatusChip status={form.status} /> : null}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>

      {formId ? (
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/forms/${formId}/build`}>
            <SquarePenIcon className="size-4" />
            Open builder
          </Link>
        </Button>
      ) : (
        <Skeleton className="h-9 w-36" />
      )}
    </div>
  );
}
