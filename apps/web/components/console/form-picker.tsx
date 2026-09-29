"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { InboxIcon } from "lucide-react";

import { resolveSelectedForm } from "~/lib/console-selection";
import { useConsoleStore } from "~/stores/console-store";

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
 * Which form a section is showing, and how to change it.
 *
 * The resolution rules live in `lib/console-selection` and are unit-tested there; this is the
 * wiring. Two things it deliberately does *not* do:
 *
 * - It does not write the chosen form into the URL on arrival. It used to, which meant the
 *   address a creator copied from a bare `/responses` was a guess about them rather than
 *   something they chose — and the "shareable link" was only ever the newest form's.
 * - It does not remember anything itself. `console-store` does, so the choice survives
 *   leaving the page, and so Responses and Analytics agree on which form you are looking at.
 */
export function useSelectedForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { forms = [], isLoading } = useListForms();

  const lastFormId = useConsoleStore((state) => state.lastFormId);

  const { selected, stale } = resolveSelectedForm({
    fromUrl: searchParams.get("form"),
    remembered: lastFormId,
    forms,
  });

  const remember = useConsoleStore((state) => state.setLastForm);

  /*
   * A first-visit fallback is a guess, so it is remembered too — otherwise every visit
   * without a parameter would re-derive it, and creating a new form would silently become
   * the answer the next time somebody looked.
   *
   * Only for a *fallback*, though, and only once. `setLastForm` clears the response filters
   * and page, because those belong to a form; calling it on every arrival wiped them the
   * moment you came back, which is the exact loss this store exists to prevent. When the
   * selection came from the URL or from memory, it is already the remembered form and
   * there is nothing to record.
   */
  useEffect(() => {
    if (isLoading || !selected) return;
    if (searchParams.get("form") === selected) return;
    if (lastFormId === selected) return;

    remember(selected);
  }, [isLoading, selected, searchParams, lastFormId, remember]);

  const select = (formId: string) => {
    remember(formId);

    const params = new URLSearchParams(searchParams.toString());
    params.set("form", formId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return { selected, stale, select, forms, isLoading };
}
