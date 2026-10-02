"use client";

import { useCallback, useState } from "react";

import { FormRuntime } from "~/components/form/form-runtime";
import { PasswordGate, UNLOCK_STORAGE_KEY } from "./password-gate";
import { useGetFormBySlug } from "~/hooks/api/public";

/**
 * Holds a protected form behind its password.
 *
 * The unlock token is kept here *and* set as a cookie by the API, so the next server render
 * of this route already sees the unlock and never asks again. Until then the client has to
 * fetch the definition itself, because the server was told not to send it.
 *
 * The token is also read back out of `sessionStorage` on mount, which the password prompt
 * writes. Without that the unlock lived only in component state, so anything that remounted
 * this shell — a re-render boundary, a client-side navigation — dropped the respondent back
 * onto the prompt despite their having answered correctly a moment earlier. With it, the
 * unlock is a property of the tab rather than of one component instance.
 */
export function PublicFormShell({ slug, locked }: { slug: string; locked: boolean }) {
  const [unlockToken, setUnlockToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(UNLOCK_STORAGE_KEY(slug));
    } catch {
      // Private browsing modes can refuse storage. The cookie still carries the unlock, so the
      // form works on the next load even though this tab has to ask again.
      return null;
    }
  });

  const onUnlocked = useCallback((token: string) => setUnlockToken(token), []);

  if (!locked) return null;

  if (!unlockToken) return <PasswordGate slug={slug} onUnlocked={onUnlocked} />;

  return <UnlockedForm slug={slug} unlockToken={unlockToken} />;
}

function UnlockedForm({ slug, unlockToken }: { slug: string; unlockToken: string }) {
  const { data, isLoading, isError } = useGetFormBySlug(slug, unlockToken);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
        Opening the form…
      </div>
    );
  }

  if (isError || !data?.form) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p role="alert" className="text-destructive text-sm">
          That password did not open the form. Try again.
        </p>
      </div>
    );
  }

  return <FormRuntime form={{ ...data.form, slug }} unlockToken={unlockToken} />;
}
