"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { InboxIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useListForms } from "~/hooks/api/form";

/**
 * Which form a section is looking at.
 *
 * The form is a *filter* here, not the resource, so it lives in the query string rather than
 * the path. Two things fall out of that: `/responses` is a real page with no form chosen, so
 * the sidebar link never points at nothing, and a creator can paste a link to one form's
 * responses into a chat and have it open the same table.
 *
 * Drafts are listed too. A draft cannot collect responses, so "zero responses" is the honest
 * answer for one; hiding them would leave a new creator with a single draft staring at an
 * empty picker, wondering where their form had gone.
 */
export function FormPicker({
  value,
  onChange,
  label = "Form",
}: {
  value: string | null;
  onChange: (formId: string) => void;
  label?: string;
}) {
  const { forms = [], isLoading } = useListForms();

  if (isLoading) {
    return <div className="h-9 w-64 animate-pulse rounded-md bg-muted" aria-hidden="true" />;
  }

  if (forms.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <InboxIcon className="size-4" />
        No forms yet
      </p>
    );
  }

  const live = forms.filter((form) => form.status !== "DRAFT");
  const drafts = forms.filter((form) => form.status === "DRAFT");

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full sm:w-72">
        <SelectValue placeholder="Choose a form" />
      </SelectTrigger>
      <SelectContent>
        {live.length > 0 && (
          <SelectGroup>
            <SelectLabel>Published</SelectLabel>
            {live.map((form) => (
              <SelectItem key={form.id} value={form.id}>
                {form.title}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {drafts.length > 0 && (
          <SelectGroup>
            <SelectLabel>Drafts</SelectLabel>
            {drafts.map((form) => (
              <SelectItem key={form.id} value={form.id}>
                {form.title}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * Reads the form out of `?form=`, choosing one when the URL does not say.
 *
 * The default is the most recently updated form, because somebody who has just been editing
 * something and then clicks "Responses" almost always means the thing they were editing —
 * and because an empty page behind a sidebar link is a worse answer than a plausible one.
 * The choice is written back to the URL, so the first render is shareable and the browser's
 * back button behaves.
 */
export function useSelectedForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { forms = [], isLoading } = useListForms();

  const fromUrl = searchParams.get("form");
  const known = forms.some((form) => form.id === fromUrl);

  // An id that is not in the list is a stale link — a form deleted, or another account's.
  // Falling back rather than fetching it avoids rendering a permanently empty table.
  const selected = known ? fromUrl : null;

  useEffect(() => {
    if (isLoading || selected) return;

    const mostRecent = [...forms].sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
    )[0];

    if (!mostRecent) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("form", mostRecent.id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [isLoading, selected, forms, router, searchParams]);

  const select = (formId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("form", formId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return { selected, select, forms, isLoading };
}
