"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  PASSWORD_MIN_LENGTH,
  passwordProblemMessage,
  validatePasswordPair,
} from "~/lib/password-rules";

/**
 * Asks for a form password, twice.
 *
 * A modal rather than an inline field because the switch it belongs to is a *promise* that the
 * form is closed, and there is no password to keep it on. Turning it on has to take a password
 * or it has to fail visibly; it can never sit on looking switched-on over an open form.
 *
 * The confirmation field is not belt-and-braces. Nothing can recover a forgotten form
 * password — the hash is never returned by any query and there is no reset path — so a single
 * typo locks a creator out of the responses on a form they own, permanently. Twice is cheap.
 *
 * Deliberately does not ask for the current password when changing one: the creator is already
 * inside their own builder, which is the authentication. Asking again would only make the
 * common case slower, and it protects nothing that the session does not already protect.
 */
export function PasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  serverError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => Promise<void>;
  isPending: boolean;
  serverError?: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [touched, setTouched] = useState(false);

  // Set on the password only: the confirmation is the one that is usually wrong, and
  // complaining about it on the very first keystroke is the kind of noise people tune out.
  const problem = touched ? validatePasswordPair(password, confirmation) : null;
  const confirmRef = useRef<HTMLInputElement>(null);

  // Reopening must not show the previous attempt's values or its complaint.
  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirmation("");
    setTouched(false);
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Submitting is an explicit claim that the pair is good, so show why it is not rather than
    // silently refusing to do anything.
    const invalid = validatePasswordPair(password, confirmation);
    setTouched(true);
    if (invalid) {
      confirmRef.current?.focus();
      return;
    }

    await onSubmit(password);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set a password</DialogTitle>
          <DialogDescription>
            Respondents will be asked for this before the form opens. Anyone with the link can
            see the questions once they have it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-password-new">Password</Label>
            <Input
              id="form-password-new"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={problem === "too_short"}
              aria-describedby="form-password-new-hint"
            />
            <p id="form-password-new-hint" className="text-muted-foreground text-xs">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-password-confirm">Confirm password</Label>
            <Input
              id="form-password-confirm"
              ref={confirmRef}
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-invalid={problem === "mismatch"}
              aria-describedby={
                problem === "mismatch" ? "form-password-confirm-error" : undefined
              }
            />
            {problem === "mismatch" && (
              <p
                id="form-password-confirm-error"
                role="alert"
                className="text-destructive text-xs"
              >
                {passwordProblemMessage(problem)}
              </p>
            )}
          </div>

          {problem === "too_short" && (
            <p role="alert" className="text-destructive -mt-2 text-xs">
              {passwordProblemMessage(problem)}
            </p>
          )}

          {serverError && (
            <p role="alert" className="text-destructive text-xs">
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}