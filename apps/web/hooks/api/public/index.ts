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
