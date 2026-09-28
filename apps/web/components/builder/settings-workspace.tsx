"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  FORM_THEMES,
  FORM_THEME_KEYS,
  type FormThemeKey,
} from "@repo/services/utils/theme";

import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useGetFormSettings, useSetFormPassword } from "~/hooks/api/form";
import { useBuilderStore } from "~/stores/builder-store";

/**
 * Form settings.
 *
 * Everything here writes to the store, so it saves itself like the rest of the builder.
 * The password is the exception: it is a mutation rather than a field on the form row, so
 * it is applied when set instead of on every keystroke.
 *
 * The theme thumbnails are drawn from the real token values, not screenshots — a preview
 * built from the same source as the renderer cannot drift from it.
 */

function ThemeThumbnail({ themeKey }: { themeKey: FormThemeKey }) {
  const theme = FORM_THEMES[themeKey];

  return (
    <span
      aria-hidden
      className="flex h-16 w-full flex-col justify-between rounded-lg p-2"
      style={{ background: theme.tokens["--form-bg"] }}
    >
      <span
        className="block h-2 w-3/4 rounded-full"
        style={{ background: theme.tokens["--form-heading"] }}
      />
      <span
        className="block h-6 w-full rounded-md"
        style={{ background: theme.tokens["--form-surface"] }}
      />
      <span
        className="block h-4 w-1/3 self-end rounded-full"
        style={{ background: theme.tokens["--form-accent"] }}
      />
    </span>
  );
}

function Flag({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SettingsWorkspace() {
  const { formId } = useParams<{ formId: string }>();
  const definition = useBuilderStore((state) => state.definition);
  const updateSettings = useBuilderStore((state) => state.updateSettings);
  const setLayoutMode = useBuilderStore((state) => state.setLayoutMode);

  // The settings query is what says whether a password exists; the mutation invalidates
  // it, so toggling the flag here needs no local copy to keep in step.
  const { form: settings } = useGetFormSettings(formId);
  const { setFormPasswordAsync, status, isError, error } = useSetFormPassword();

  const [password, setPassword] = useState("");
  const [cleared, setCleared] = useState(false);

  if (!definition) return null;

  const isProtected = settings?.passwordProtected ?? false;
  const apply = (patch: Parameters<typeof updateSettings>[0]) => updateSettings(patch);

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">What the form is called</h2>
          <Field>
            <FieldLabel htmlFor="s-title">Title</FieldLabel>
            <Input
              id="s-title"
              value={definition.title}
              onChange={(event) => apply({ title: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-description">Description</FieldLabel>
            <Textarea
              id="s-description"
              value={definition.description ?? ""}
              onChange={(event) => apply({ description: event.target.value || null })}
              placeholder="Shown under the title on the public form"
              className="min-h-20 resize-none"
            />
          </Field>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Layout</h2>

          <div className="flex flex-col gap-1.5">
            <Label>How respondents move through it</Label>
            <div className="flex flex-wrap gap-2">
              {(["STEP", "PAGED"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={definition.layoutMode === mode ? "default" : "outline"}
                  aria-pressed={definition.layoutMode === mode}
                  onClick={() => setLayoutMode(mode)}
                >
                  {mode === "STEP" ? "One question at a time" : "Page by page"}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {definition.layoutMode === "STEP"
                ? "Each question is its own step, with a progress bar."
                : `Questions are grouped into ${definition.pages.length} page${definition.pages.length === 1 ? "" : "s"}.`}
            </p>
          </div>

          <Flag
            id="s-progress"
            label="Show progress"
            hint="A bar telling the respondent how far along they are."
            checked={definition.showProgress}
            onChange={(checked) => apply({ showProgress: checked })}
          />
          <Flag
            id="s-back"
            label="Allow going back"
            hint="Answers are kept either way, since the draft saves as they go."
            checked={definition.allowBack}
            onChange={(checked) => apply({ allowBack: checked })}
          />
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Theme</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FORM_THEME_KEYS.map((key) => {
              const theme = FORM_THEMES[key];
              const selected = definition.themeKey === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => apply({ themeKey: key })}
                    className={[
                      "focus-visible:ring-ring flex w-full flex-col gap-1.5 rounded-xl border-2 bg-card p-2 text-left transition-colors",
                      "focus-visible:ring-2 focus-visible:outline-none",
                      selected ? "border-[#0e0f0c]" : "border-transparent hover:border-border",
                    ].join(" ")}
                  >
                    <ThemeThumbnail themeKey={key} />
                    <span className="text-sm font-medium">{theme.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Who can respond</h2>

          <Flag
            id="s-password"
            label="Require a password"
            hint="Respondents enter it before the form opens."
            checked={isProtected}
            onChange={(checked) => {
              if (checked) {
                setCleared(false);
                return;
              }
              // An empty password is how the service removes one.
              setPassword("");
              setCleared(true);
              void setFormPasswordAsync({ formId, password: "" });
            }}
          />

          {isProtected && (
            <Field>
              <FieldLabel htmlFor="s-password-value">
                {cleared ? "Set a new password" : "Change password"}
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="s-password-value"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
                <Button
                  disabled={status === "pending" || password.length < 1}
                  onClick={async () => {
                    await setFormPasswordAsync({ formId, password });
                    setPassword("");
                  }}
                >
                  {status === "pending" ? "Saving…" : "Set"}
                </Button>
              </div>
              {isError && (
                <p role="alert" className="text-destructive text-xs">
                  {error?.message ?? "That password could not be set."}
                </p>
              )}
            </Field>
          )}

          <Flag
            id="s-one-per-device"
            label="One response per device"
            hint="A device that has already answered cannot answer again."
            checked={definition.oneResponsePerDevice}
            onChange={(checked) => apply({ oneResponsePerDevice: checked })}
          />
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Limits</h2>
          <Field>
            <FieldLabel htmlFor="s-max">Maximum responses</FieldLabel>
            <Input
              id="s-max"
              type="number"
              min={1}
              value={definition.maxResponses ?? ""}
              onChange={(event) =>
                apply({
                  maxResponses: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              placeholder="Unlimited"
              className="h-9 w-32"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-closes">Close on</FieldLabel>
            <Input
              id="s-closes"
              type="date"
              value={
                definition.closesAt
                  ? new Date(definition.closesAt).toISOString().slice(0, 10)
                  : ""
              }
              onChange={(event) =>
                apply({
                  closesAt: event.target.value
                    ? new Date(`${event.target.value}T23:59:59`).toISOString()
                    : null,
                })
              }
              className="h-9 w-48"
            />
            <FieldDescription>
              The form stops accepting responses at the end of this day.
            </FieldDescription>
          </Field>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">After someone responds</h2>
          <Field>
            <FieldLabel htmlFor="s-ty-title">Thank-you heading</FieldLabel>
            <Input
              id="s-ty-title"
              value={definition.thankYouTitle ?? ""}
              onChange={(event) => apply({ thankYouTitle: event.target.value || null })}
              placeholder="Thanks for your time"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-ty-message">Thank-you message</FieldLabel>
            <Textarea
              id="s-ty-message"
              value={definition.thankYouMessage ?? ""}
              onChange={(event) => apply({ thankYouMessage: event.target.value || null })}
              placeholder="We will be in touch."
              className="min-h-20 resize-none"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-ty-redirect">Send them to a page afterwards</FieldLabel>
            <Input
              id="s-ty-redirect"
              value={definition.thankYouRedirectUrl ?? ""}
              onChange={(event) => apply({ thankYouRedirectUrl: event.target.value || null })}
              placeholder="https://example.com/thanks"
            />
          </Field>
        </section>
      </div>
    </div>
  );
}
