import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFormClient } from "./public-form-client";
import { PasswordGate } from "./password-gate";
import { getCurrentFormBySlug } from "~/lib/public-form";

/**
 * The public form, fetched on the server so the first paint is the real form.
 *
 * Rendered on the server, driven on the client: `PublicFormClient` owns the session and
 * the answers and hands them to the same `FormRenderer` the builder's preview uses.
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
    return <UnavailableScreen reason={result.reason} />;
  }

  // Locked: the API withholds the definition until the password is right, so all the
  // server can do is say that a password is needed.
  if (result.locked) {
    return <PasswordGate slug={slug} />;
  }

  return <PublicFormClient form={result.form} />;
}

const SCREEN = "flex min-h-screen items-center justify-center bg-[#e8ebe6] px-4";

const UNAVAILABLE: Record<string, { title: string; body: string }> = {
  NOT_PUBLISHED: {
    title: "This form is not open",
    body: "The creator has not published it yet.",
  },
  EXPIRED: {
    title: "This form has closed",
    body: "It is no longer accepting responses.",
  },
  LIMIT_REACHED: {
    title: "This form is full",
    body: "It has collected as many responses as its creator allowed.",
  },
};

function UnavailableScreen({ reason }: { reason: string | null }) {
  const { title, body } = UNAVAILABLE[reason ?? ""] ?? {
    title: "Form not found",
    body: "The link may be wrong, or the form may have been deleted.",
  };

  return (
    <main className={SCREEN}>
      <div className="max-w-sm rounded-xl bg-white p-8 text-center">
        <h1 className="text-xl font-bold tracking-tight text-[#0e0f0c]">{title}</h1>
        <p className="mt-2 text-sm text-[#454745]">{body}</p>
      </div>
    </main>
  );
}
