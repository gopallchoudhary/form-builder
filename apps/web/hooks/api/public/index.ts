import { trpc } from "~/trpc/client";

/**
 * Public (respondent-facing) hooks.
 *
 * Nothing here is authenticated: the respondent is identified only by the random device
 * id the client holds, which is why every call takes `deviceId` alongside the session.
 * These are the procedures the runner store drives, and the ones behind the tighter rate
 * limits — `unlockForm` and `submitForm` are `sensitivePublicProcedure` on the server.
 *
 * A cached `getFormBySlug` is what the runtime renders from, so it is deliberately stale-
 * tolerant: the form version travels with the session, and the server re-validates on
 * submit regardless of what the client shows.
 */

export const useGetFormBySlug = (slug: string | null, unlockToken?: string) =>
  trpc.public.getFormBySlug.useQuery(
    { slug: slug ?? "", ...(unlockToken ? { unlockToken } : {}) },
    { enabled: !!slug, staleTime: 30_000 },
  );

export const useUnlockForm = () => trpc.public.unlockForm.useMutation();

export const useStartSession = () => trpc.public.startSession.useMutation();

export const useGetSession = (sessionId: string | null, deviceId: string | null) =>
  trpc.public.getSession.useQuery(
    { sessionId: sessionId ?? "", deviceId: deviceId ?? "" },
    { enabled: !!sessionId && !!deviceId, staleTime: Infinity },
  );

export const useSaveDraft = () => trpc.public.saveDraft.useMutation();

export const useSubmitForm = () => {
  const utils = trpc.useUtils();

  return trpc.public.submitForm.useMutation({
    onSuccess: async () => {
      // The form is finished; a stale session would let a back button replay the answers.
      await utils.public.getSession.invalidate();
    },
  });
};

//, a poll for voters: meta always, tally only once this device voted
export const usePublicPoll = (slug: string | null, deviceId: string | null) => {
  const { data: poll, isLoading, isFetching, isError, error, refetch } =
    trpc.poll.getPollBySlug.useQuery(
      { slug: slug ?? "", ...(deviceId ? { deviceId } : {}) },
      { enabled: !!slug },
    );

  return { poll, isLoading, isFetching, isError, error, refetch };
};

//, vote or move a vote; the tally refreshes itself from the broadcast
export const useCastVote = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: castVoteAsync, status, isError, error } =
    trpc.poll.castVote.useMutation({
      onSuccess: async () => {
        // The broadcast usually beats this refetch, and that is fine: both converge on the
        // same tally, and the refetch is what covers a missed broadcast.
        await utils.poll.getPollBySlug.invalidate();
      },
    });

  return { castVoteAsync, status, isError, error };
};
