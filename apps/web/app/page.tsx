import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingPage } from "~/components/landing/landing-page";
import { getCurrentUser } from "~/lib/auth";

export const metadata: Metadata = {
  title: "Formora — Forms and live polls",
  description:
    "Build shareable forms for detailed feedback and live polls for group decisions. Respondents can answer from a public link without a Formora account.",
  openGraph: {
    title: "Formora — Forms and live polls",
    description:
      "Build shareable forms for detailed feedback and live polls for group decisions. Respondents can answer from a public link without a Formora account.",
    type: "website",
  },
};

/**
 * The public marketing page for signed-out visitors; the creator's workspace remains the
 * home for signed-in users.
 *
 * The user check stays server-side, so an existing session goes straight to the dashboard
 * before the landing page paints, while a new visitor gets the marketing page rather than
 * being sent to login with no context.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <LandingPage />;
}
