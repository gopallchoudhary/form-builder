import { getFormTheme } from "@repo/services/utils/theme";
import type { FormTheme } from "@repo/services/utils/theme";
import { FormThemeProvider } from "./theme-provider";
import { ClockIcon, LockIcon, MailCheckIcon, TriangleAlertIcon } from "lucide-react";

/**
 * The screens a respondent reaches instead of the form.
 *
 * Each one says what happened and, where there is something to do about it, says what to
 * do. They share the form's own theme, because a form that closes should still look like
 * the form it was — the same person designed it.
 */

/** The reason a respondent cannot see the form, as the API reports it. */
export type UnavailableReason =
  | "NOT_PUBLISHED"
  | "EXPIRED"
  | "LIMIT_REACHED"
  | "ALREADY_SUBMITTED"
  | "NOT_FOUND"
  | "ERROR";

interface ScreenCopy {
  title: string;
  body: string;
  icon: typeof ClockIcon;
}

/** Total by construction, so a new reason cannot be added without its copy. */
const SCREENS: Record<UnavailableReason, ScreenCopy> = {
  NOT_PUBLISHED: {
    title: "This form is not open",
    body: "The creator has not published it yet. Check back later, or ask them for a new link.",
    icon: ClockIcon,
  },
  EXPIRED: {
    title: "This form has closed",
    body: "It stopped accepting responses on its closing date.",
    icon: ClockIcon,
  },
  LIMIT_REACHED: {
    title: "This form is full",
    body: "It has collected as many responses as its creator allowed. Your answers could not be recorded.",
    icon: TriangleAlertIcon,
  },
  ALREADY_SUBMITTED: {
    title: "You have already responded",
    body: "This form accepts one response per device, and this one has been sent. Nothing further is needed.",
    icon: MailCheckIcon,
  },
  NOT_FOUND: {
    title: "We could not find that form",
    body: "The link may have a typo in it, or the form may have been deleted.",
    icon: TriangleAlertIcon,
  },
  ERROR: {
    title: "Something went wrong",
    body: "We could not open the form just now. Try reloading the page.",
    icon: TriangleAlertIcon,
  },
};

export function FormStateScreen({
  reason,
  themeKey = "sage",
}: {
  reason: UnavailableReason;
  themeKey?: string;
}) {
  const theme = getFormTheme(themeKey);
  const screen = SCREENS[reason];
  const Icon = screen.icon;

  return (
    <Frame theme={theme}>
      <div
        role="status"
        className="flex flex-col items-center rounded-xl p-8 text-center"
        style={{
          background: theme.tokens["--form-surface"],
          color: theme.tokens["--form-text"],
        }}
      >
        <span
          className="flex size-11 items-center justify-center rounded-full"
          style={{ background: theme.tokens["--form-bg"] }}
        >
          <Icon className="size-5" style={{ color: theme.tokens["--form-muted"] }} />
        </span>

        <h1
          className="mt-4 text-xl font-bold tracking-tight"
          style={{ color: theme.tokens["--form-heading"] }}
        >
          {screen.title}
        </h1>
        <p className="mt-2 text-sm" style={{ color: theme.tokens["--form-muted"] }}>
          {screen.body}
        </p>
      </div>
    </Frame>
  );
}

/** The password prompt. Themed like the form, because it is the form's front door. */
export function LockedScreen({
  themeKey = "sage",
  children,
}: {
  themeKey?: string;
  children: React.ReactNode;
}) {
  const theme = getFormTheme(themeKey);

  return (
    <Frame theme={theme}>
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{
          background: theme.tokens["--form-surface"],
          color: theme.tokens["--form-text"],
        }}
      >
        <span
          className="flex size-11 items-center justify-center rounded-full"
          style={{ background: theme.tokens["--form-bg"] }}
        >
          <LockIcon className="size-5" style={{ color: theme.tokens["--form-muted"] }} />
        </span>
        <h1
          className="mt-4 text-xl font-bold tracking-tight"
          style={{ color: theme.tokens["--form-heading"] }}
        >
          This form is protected
        </h1>
        <p className="mt-2 text-sm" style={{ color: theme.tokens["--form-muted"] }}>
          Enter the password the creator gave you to continue.
        </p>
        <div className="mt-5">{children}</div>
      </div>
    </Frame>
  );
}

function Frame({ theme, children }: { theme: FormTheme; children: React.ReactNode }) {
  return (
    <FormThemeProvider
      theme={theme}
      // Scoped to this element through the token, rather than a global `body` rule: a
      // component that restyles the whole document would leak into any page it is
      // ever mounted on.
      className="flex min-h-screen items-center justify-center bg-[var(--form-bg)] px-4 py-10"
    >
      <div className="w-full max-w-md">{children}</div>
    </FormThemeProvider>
  );
}
