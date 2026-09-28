"use client";

import { useEffect, useState } from "react";
import { getFormTheme } from "@repo/services/utils/theme";
import { FormThemeProvider } from "~/components/form/theme-provider";
import { CheckIcon } from "lucide-react";

/**
 * The confirmation, in the form's own words and colours.
 *
 * A creator's redirect is offered rather than taken: somebody who set one usually wants the
 * respondent somewhere specific, and somebody who set one carelessly should still see that
 * their response was recorded. Sending them onward automatically would also mean this page
 * never renders, which is the one thing it exists to do.
 */
export function ThankYouCard({
  form,
}: {
  form: {
    title: string;
    themeKey: string;
    thankYouTitle: string | null;
    thankYouMessage: string | null;
    thankYouRedirectUrl: string | null;
  };
}) {
  const theme = getFormTheme(form.themeKey);
  const [readyToLeave, setReadyToLeave] = useState(false);

  useEffect(() => {
    if (!form.thankYouRedirectUrl) return;
    const timer = setTimeout(() => setReadyToLeave(true), 4000);
    return () => clearTimeout(timer);
  }, [form.thankYouRedirectUrl]);

  return (
    <FormThemeProvider
      theme={theme}
      className="flex min-h-screen items-center justify-center bg-[var(--form-bg)] px-4 py-10"
    >
      <div
        className="w-full max-w-md rounded-xl p-8 text-center"
        style={{
          background: theme.tokens["--form-surface"],
          color: theme.tokens["--form-text"],
        }}
      >
        <span
          className="mx-auto flex size-11 items-center justify-center rounded-full"
          style={{ background: theme.tokens["--form-accent"] }}
        >
          <CheckIcon className="size-5" style={{ color: theme.tokens["--form-accent-fg"] }} />
        </span>

        <h1
          className="mt-5 text-2xl font-bold tracking-tight"
          style={{ color: theme.tokens["--form-heading"] }}
        >
          {form.thankYouTitle ?? "Thank you"}
        </h1>

        <p className="mt-2 text-sm" style={{ color: theme.tokens["--form-muted"] }}>
          {form.thankYouMessage ?? "Your response has been recorded."}
        </p>

        {form.thankYouRedirectUrl && (
          <div className="mt-6">
            <a
              href={form.thankYouRedirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-xl px-6 py-2.5 text-sm font-semibold"
              style={{
                background: theme.tokens["--form-accent"],
                color: theme.tokens["--form-accent-fg"],
              }}
            >
              Continue
            </a>
            {readyToLeave && (
              <p className="mt-3 text-xs" style={{ color: theme.tokens["--form-muted"] }}>
                Taking you there automatically shortly.
              </p>
            )}
          </div>
        )}
      </div>
    </FormThemeProvider>
  );
}
