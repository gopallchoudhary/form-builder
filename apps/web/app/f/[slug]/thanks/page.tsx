import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormStateScreen } from "~/components/form/form-states";
import { ThankYouCard } from "./thank-you-card";
import { getCurrentFormBySlug } from "~/lib/public-form";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/**
 * Where a submission lands.
 *
 * The copy comes from the form's own thank-you settings, because that is what the creator
 * wrote for the people who answered. A creator's redirect is honoured, but only after the
 * confirmation has been seen — bouncing straight to an external site skips the only thing
 * this page is for.
 */
export default async function ThanksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getCurrentFormBySlug(slug);

  if (!result.ok) notFound();

  if (!result.form) {
    return <FormStateScreen reason="NOT_FOUND" />;
  }

  return <ThankYouCard form={result.form} />;
}
