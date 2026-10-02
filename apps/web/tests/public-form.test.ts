import { describe, expect, it } from "vitest";

import { decidePublicForm } from "~/lib/public-form";

/**
 * Which screen a respondent gets for a given API result.
 *
 * The bug these pin: a password-protected form reports `locked: true`, `form: null` *and*
 * `reason: null` — available, just gated. The route tested for a missing definition first,
 * which a locked form matches, invented a `NOT_FOUND` reason from the absent one, and told
 * people their live, published form did not exist. The lock branch could never run, because
 * `locked` is only true exactly when `form` is null.
 *
 * A discriminated union removes the ordering entirely: there is one place where each case is
 * decided, and a caller switches on `kind`.
 */

const FORM = {
  id: "form-1",
  slug: "hiring",
  title: "Hiring",
  description: null,
  layoutMode: "STEP",
  themeKey: "sage",
  pages: [],
  questions: [],
};

describe("decidePublicForm", () => {
  it("shows a live form", () => {
    const decision = decidePublicForm({
      ok: true,
      available: true,
      reason: null,
      locked: false,
      form: FORM,
    } as never);

    expect(decision.kind).toBe("form");
  });

  it("asks for the password rather than claiming the form is missing", () => {
    // The exact payload the service returns for a protected form: `access/index.ts` withholds
    // the definition and leaves `reason` unset, because nothing is actually wrong.
    const decision = decidePublicForm({
      ok: true,
      available: true,
      reason: null,
      locked: true,
      form: null,
    } as never);

    expect(decision.kind).toBe("locked");
  });

  it("404s a slug the API does not know", () => {
    const decision = decidePublicForm({ ok: false });

    expect(decision.kind).toBe("missing");
  });

  it("keeps the reason for a form that exists but is unavailable", () => {
    const decision = decidePublicForm({
      ok: true,
      available: false,
      reason: "EXPIRED",
      locked: false,
      form: null,
    } as never);

    expect(decision).toEqual({ kind: "unavailable", reason: "EXPIRED" });
  });

  it.each(["NOT_PUBLISHED", "LIMIT_REACHED", "ALREADY_SUBMITTED"])(
    "passes %s through rather than flattening it to not-found",
    (reason) => {
      const decision = decidePublicForm({
        ok: true,
        available: false,
        reason,
        locked: false,
        form: null,
      } as never);

      expect(decision).toEqual({ kind: "unavailable", reason });
    },
  );

  it("never calls a protected form missing, whatever else is true of it", () => {
    // The regression in one assertion: every combination a protected form can arrive in has to
    // resolve to the password prompt.
    for (const reason of [null, "NOT_PUBLISHED"] as const) {
      const decision = decidePublicForm({
        ok: true,
        available: true,
        reason,
        locked: true,
        form: null,
      } as never);

      expect(decision.kind).not.toBe("missing");
      expect(decision.kind).not.toBe("unavailable");
      expect(decision.kind).toBe("locked");
    }
  });
});