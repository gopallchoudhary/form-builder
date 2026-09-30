"use client";

import Link from "next/link";
import { useCallback, type ReactNode } from "react";

import { trpc } from "~/trpc/client";
import { useBuilderStore } from "~/stores/builder-store";

/**
 * A link into a form's builder that starts from the server, not from the last visit.
 *
 * Both halves are needed, and either alone leaves a real bug:
 *
 * `reset()` empties the store so `BuilderChrome` re-hydrates rather than matching the
 * definition it is already holding. The store is module-level and outlives every page, so
 * without it a form opened from here would render the previous visit's questions and status.
 * That protection is what stops a tab switch throwing away unsaved work, which is why it
 * cannot simply be removed from the hydrate guard.
 *
 * Invalidating `getForm` fetches the form again. The query runs with `staleTime: Infinity`,
 * so a cached copy is served without refetching — and a form edited or deleted in another tab
 * would arrive here as its old self, with the reset faithfully re-hydrating stale data. One
 * request on an explicit click is the right price for being sure.
 *
 * Deliberately not used on the sidebar's resume link. That path exists to go *back* to a form
 * the creator was already working on, where discarding the store would throw away the live
 * definition for no benefit.
 */
export function BuilderLink({
  formId,
  href,
  className,
  children,
  prefetch,
}: {
  formId: string;
  href: string;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  const reset = useBuilderStore((state) => state.reset);
  const utils = trpc.useUtils();

  const onClick = useCallback(() => {
    reset();
    void utils.form.getForm.invalidate({ formId });
  }, [formId, reset, utils]);

  return (
    <Link href={href} className={className} prefetch={prefetch} onClick={onClick}>
      {children}
    </Link>
  );
}
