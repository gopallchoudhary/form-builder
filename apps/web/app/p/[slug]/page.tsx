import type { Metadata } from "next";

import { PollVoter } from "./poll-voter";
import { createServerCaller } from "~/trpc/server-caller";

/**
 * Never cached.
 *
 * Tallies move on every vote, and a cached render would serve one device's view of the
 * count to the next. Same reasoning as the public form route, which this mirrors.
 */
export const dynamic = "force-dynamic";

/**
 * The public poll.
 *
 * The server only supplies metadata and the shell: whether this browser voted lives in
 * localStorage, which the server cannot see, so every state — loading, missing, closed,
 * vote, results — is decided client-side from the poll query.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const api = await createServerCaller();
    const poll = await api.poll.getPollBySlug.query({ slug });

    return {
      title: poll.title,
      description: poll.description ?? undefined,
      // A poll is a link people paste into chat; indexing it helps nobody.
      robots: { index: false, follow: false },
    };
  } catch {
    // Unknown slug or draft: the page itself renders the missing state, and the title
    // must not leak which of the two it was.
    return { title: "Poll not available" };
  }
}

export default async function PublicPollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <PollVoter slug={slug} />;
}
