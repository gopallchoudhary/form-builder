"use client";

import { useState } from "react";

import { LockedScreen } from "~/components/form/form-states";
import { useUnlockForm } from "~/hooks/api/public";

/**
 * The password prompt for a protected form.
 *
 * The API also sets the unlock token as a cookie, so this is a door and not a wall: a
 * refresh finds the form already open. The token is HMAC-signed, scoped to one form and
 * carries its own expiry, so keeping it in `sessionStorage` as well adds no risk.
 */
export function PasswordGate({
  slug,
  onUnlocked,
}: {
  slug: string;
  onUnlocked: (token: string) => void;
}) {
  const { mutateAsync: unlockAsync, isPending } = useUnlockForm();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    try {
      const result = await unlockAsync({ slug, password });

      if (!result.unlocked) {
        // A wrong password is an ordinary wrong guess, not an error state, and the service
        // already has a message for it.
        setMessage(result.message ?? "That password is not right.");
        setPassword("");
        return;
      }

      const token = result.unlockToken ?? "";
      sessionStorage.setItem(`streamyst:unlock:${slug}`, token);
      onUnlocked(token);
    } catch {
      setMessage("Could not check that password. Try again.");
    }
  };

  return (
    <LockedScreen>
      <form onSubmit={submit}>
        <label htmlFor="form-password" className="sr-only">
          Password
        </label>
        <input
          id="form-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          aria-describedby={message ? "form-password-error" : undefined}
          className="w-full rounded-md border border-[var(--form-border)] bg-[var(--form-surface)] px-3 py-2.5 text-[var(--form-text)] outline-none placeholder:text-[var(--form-muted)] focus-visible:ring-2 focus-visible:ring-[var(--form-accent)]"
        />

        {message && (
          <p id="form-password-error" role="alert" className="mt-2 text-sm font-medium text-destructive">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || password.length === 0}
          className="mt-4 w-full rounded-xl bg-[var(--form-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--form-accent-fg)] disabled:opacity-60"
        >
          {isPending ? "Checking…" : "Continue"}
        </button>
      </form>
    </LockedScreen>
  );
}
