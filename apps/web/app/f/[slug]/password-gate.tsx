"use client";

import { useState } from "react";

import { useUnlockForm } from "~/hooks/api/public";

/**
 * The password gate for a protected form.
 *
 * The unlock token is kept in `sessionStorage`, not `localStorage`: it is scoped to this
 * browser tab and does not survive it, so closing the tab re-locks the form. The
 * respondent runtime is Phase 6 — this only has to get them past the door.
 */
export function PasswordGate({ slug }: { slug: string }) {
  const { mutateAsync: unlockAsync, isPending, error } = useUnlockForm();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    try {
      const result = await unlockAsync({ slug, password });
      if (!result.unlocked) {
        setMessage(result.message ?? "That password is not right.");
        return;
      }
      sessionStorage.setItem(`streamyst:unlock:${slug}`, result.unlockToken ?? "");
      setUnlocked(true);
    } catch {
      setMessage("Could not check that password. Try again.");
    }
  };

  if (unlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#e8ebe6] px-4">
        <div className="max-w-sm rounded-xl bg-white p-8 text-center">
          <h1 className="text-xl font-bold tracking-tight text-[#0e0f0c]">Unlocked</h1>
          <p className="mt-2 text-sm text-[#454745]">
            The form will load here. Refreshing this page keeps you unlocked.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8ebe6] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-8"
      >
        <h1 className="text-xl font-bold tracking-tight text-[#0e0f0c]">
          This form is protected
        </h1>
        <p className="mt-2 text-sm text-[#454745]">
          Enter the password the creator gave you to continue.
        </p>

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
          className="mt-4 w-full rounded-md border border-[#0e0f0c] px-3 py-2.5 text-[#0e0f0c] outline-none focus-visible:ring-2 focus-visible:ring-[#9fe870]"
        />

        {message && (
          <p role="alert" className="mt-2 text-sm font-medium text-[#d03238]">
            {message}
          </p>
        )}
        {error && !message && (
          <p role="alert" className="mt-2 text-sm font-medium text-[#d03238]">
            Could not check that password. Try again.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || password.length === 0}
          className="mt-4 w-full rounded-xl bg-[#9fe870] px-6 py-2.5 text-sm font-semibold text-[#0e0f0c] disabled:opacity-60"
        >
          {isPending ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
