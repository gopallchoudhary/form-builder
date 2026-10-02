import { isTRPCClientError, type RouterOutputs } from "@repo/trpc/client";

import { createServerCaller } from "~/trpc/server-caller";

/**
 * What the public route needs to know about a form, from the server.
 *
 * Four outcomes, and they are not interchangeable: a missing form is a 404, an
 * unpublished one is a real page that says so, and a protected one must not leak the
 * definition. The API makes that distinction in its response and this type preserves it.
 *
 * The form shape is taken from the router output rather than restated, so a field added
 * to the public schema cannot be forgotten here — the page would simply not receive it.
 */
type PublicFormOutput = RouterOutputs["public"]["getFormBySlug"];

export type PublicFormResult =
  | { ok: false }
  | ({ ok: true } & PublicFormOutput);

/**
 * Fetch a form for the public route.
 *
 * A 404 is the only failure swallowed. Anything else — a 500, a rate limit, a network
 * fault — is rethrown so it surfaces as an error page instead of being shown to a
 * respondent as "this form does not exist", which would be a lie about a form that
 * still exists and is still open.
 */
export async function getCurrentFormBySlug(slug: string): Promise<PublicFormResult> {
  try {
    const api = await createServerCaller();
    const result = await api.public.getFormBySlug.query({ slug });

    // The whole output is passed through, so this type cannot fall behind the router.
    return { ok: true, ...result };
  } catch (error) {
    if (isTRPCClientError(error) && error.data?.code === "NOT_FOUND") {
      return { ok: false };
    }
    throw error;
  }
}

/**
 * What the public route should render, worked out in one place.
 *
 * Extracted because the four outcomes are not interchangeable and getting the order wrong is
 * invisible until a form is in an unusual state. A password-protected form reports
 * `locked: true`, `form: null` and `reason: null` — available, just gated — so it matches
 * "there is no form" as readily as it matches "there is a lock". A page that tested for the
 * missing form first reported every protected form as deleted, and the lock branch could not
 * run: `locked` is only ever true when `form` is null, which is exactly what the missing-form
 * branch matches.
 *
 * A discriminated union makes that unrepresentable. Each case is checked once, the caller
 * switches on `kind`, and no ordering mistake can turn a live form into a 404.
 */
export type PublicFormDecision =
  | { kind: "missing" }
  | { kind: "unavailable"; reason: string | null }
  | { kind: "locked" }
  | { kind: "form"; form: NonNullable<PublicFormOutput["form"]> };

export function decidePublicForm(result: PublicFormResult): PublicFormDecision {
  // A slug the API does not know at all, which is a 404 rather than a page.
  if (!result.ok) return { kind: "missing" };

  // Before the missing-form case, and necessarily so: a locked form has no definition yet.
  if (result.locked) return { kind: "locked" };

  if (!result.form) return { kind: "unavailable", reason: result.reason };

  return { kind: "form", form: result.form };
}
