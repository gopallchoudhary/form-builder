import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormRuntime } from "~/components/form/form-runtime";
import { FormStateScreen, type UnavailableReason } from "~/components/form/form-states";
import { PublicFormShell } from "./public-form-shell";
import { getCurrentFormBySlug } from "~/lib/public-form";

/**
 * Never cached.
 *
 * The definition comes from the database through a server caller, which Next.js knows
 * nothing about, so without this the route is treated as static: the first request for a
 * slug renders it, and every later request is served that same render from disk. A
 * creator who added a question and republished was then still handing respondents the
 * form as it looked before the edit — the most damaging bug this app could have, and one
 * no unit test would ever catch, because the server was faithfully returning a cache.
 */
export const dynamic = "force-dynamic";

/**
 * The public form.
 *
 * The definition is fetched on the server so the first paint is the real form rather than
 * a spinner, and so a form that is closed or full is decided before any JavaScript runs.
 * A password-protected form is the exception: its definition is withheld until the password
 * is right, so the server can only render the gate.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCurrentFormBySlug(slug);

  if (!result.ok || !result.form) {
    return { title: "Form not available" };
  }

  return {
    title: result.form.title,
    description: result.form.description ?? undefined,
    // A form is a link people paste into chat; indexing it helps nobody.
    robots: { index: false, follow: false },
  };
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getCurrentFormBySlug(slug);

  if (!result.ok) notFound();

  if (!result.form) {
    return <FormStateScreen reason={(result.reason ?? "NOT_FOUND") as UnavailableReason} />;
  }

  if (result.locked) {
    // The theme is part of the definition, which is exactly what is being withheld, so the
    // gate uses the default until the password is supplied.
    return <PublicFormShell slug={slug} locked />;
  }

  return <FormRuntime form={result.form} />;
}
