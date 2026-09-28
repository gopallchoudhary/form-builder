"use client";

import { StarIcon } from "lucide-react";

import type { AnswerValue } from "~/stores/runner-store";

/**
 * The per-kind answer control.
 *
 * Native elements rather than the Radix set: a form the public fills in is exactly where
 * keyboard and screen-reader behaviour matters most, and `<input>`, `<select>` and
 * `<textarea>` already have it. The DESIGN.md form styling is a 1px border on a white
 * surface, which needs no component to achieve.
 *
 * Everything reads the `--form-*` custom properties, so this file contains no colours.
 */

export interface QuestionInputProps {
  id: string;
  kind: string;
  settings: unknown;
  placeholder: string | null;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  /** Binds a label to the control, so the question text is announced with it. */
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}

const controlClass =
  "w-full rounded-md border border-[var(--form-border)] bg-[var(--form-surface)] px-3 py-2.5 text-[var(--form-text)] outline-none placeholder:text-[var(--form-muted)] focus-visible:ring-2 focus-visible:ring-[var(--form-accent)] disabled:opacity-60";

interface TextSettings {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asOptions(value: unknown): Array<{ id: string; label: string }> {
  const options = asRecord(value).options;
  return Array.isArray(options) ? (options as Array<{ id: string; label: string }>) : [];
}

const ADDRESS_FIELDS: Array<{ key: string; label: string; type: string; autoComplete: string }> = [
  { key: "line1", label: "Address", type: "text", autoComplete: "address-line1" },
  { key: "line2", label: "Apartment, suite (optional)", type: "text", autoComplete: "address-line2" },
  { key: "city", label: "City", type: "text", autoComplete: "address-level2" },
  { key: "state", label: "State / region", type: "text", autoComplete: "address-level1" },
  { key: "postalCode", label: "Postal code", type: "text", autoComplete: "postal-code" },
  { key: "country", label: "Country", type: "text", autoComplete: "country-name" },
];

export function QuestionInput({
  id,
  kind,
  settings,
  placeholder,
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid,
  disabled,
}: QuestionInputProps) {
  const common = {
    id,
    disabled,
    "aria-labelledby": labelledBy,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
  } as const;

  switch (kind) {
    case "LONG_TEXT":
      return (
        <textarea
          {...common}
          className={`${controlClass} min-h-28 resize-y`}
          placeholder={placeholder ?? undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "NUMBER": {
      const { min, max, integer } = asRecord(settings) as {
        min?: number;
        max?: number;
        integer?: boolean;
      };
      return (
        <input
          {...common}
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          className={controlClass}
          placeholder={placeholder ?? undefined}
          min={min}
          max={max}
          step={integer ? 1 : "any"}
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }

    case "EMAIL":
      return (
        <input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={controlClass}
          placeholder={placeholder ?? "name@example.com"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "PHONE":
      return (
        <input
          {...common}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={controlClass}
          placeholder={placeholder ?? undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "PASSWORD":
      return (
        <input
          {...common}
          type="password"
          autoComplete="current-password"
          className={controlClass}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "DATE": {
      const { min, max } = asRecord(settings) as { min?: string; max?: string };
      return (
        <input
          {...common}
          type="date"
          className={controlClass}
          min={min}
          max={max}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }

    case "YES_NO":
      return (
        <div {...common} role="radiogroup" className="flex flex-wrap gap-2">
          {[
            { label: "Yes", next: true },
            { label: "No", next: false },
          ].map((option) => {
            const selected = value === option.next;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(option.next)}
                className={[
                  "rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors",
                  selected
                    ? "border-[var(--form-accent)] bg-[var(--form-accent)] text-[var(--form-accent-fg)]"
                    : "border-[var(--form-border)] bg-[var(--form-surface)] text-[var(--form-text)]",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );

    case "SINGLE_CHOICE":
    case "DROPDOWN": {
      const options = asOptions(settings);
      if (kind === "DROPDOWN") {
        return (
          <select
            {...common}
            className={controlClass}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{placeholder ?? "Select an option"}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
      return (
        <div {...common} role="radiogroup" className="flex flex-col gap-2">
          {options.map((option) => {
            const selected = value === option.id;
            return (
              <label
                key={option.id}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                  selected
                    ? "border-[var(--form-accent)] bg-[var(--form-surface)]"
                    : "border-[var(--form-border)] bg-[var(--form-surface)]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={id}
                  className="accent-[var(--form-accent)]"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(option.id)}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      );
    }

    case "MULTI_CHOICE": {
      const options = asOptions(settings);
      const selected = Array.isArray(value) ? value : [];
      return (
        <div {...common} role="group" className="flex flex-col gap-2">
          {options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--form-border)] bg-[var(--form-surface)] px-4 py-3 text-sm transition-colors"
              >
                <input
                  type="checkbox"
                  className="accent-[var(--form-accent)]"
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((item) => item !== option.id)
                        : [...selected, option.id],
                    )
                  }
                />
                {option.label}
              </label>
            );
          })}
        </div>
      );
    }

    case "RATING": {
      const { scale = 5, style = "STAR", lowLabel, highLabel } = asRecord(settings) as {
        scale?: 3 | 5 | 7 | 10;
        style?: "STAR" | "NUMBER";
        lowLabel?: string;
        highLabel?: string;
      };
      const count = scale;
      const current = typeof value === "number" ? value : 0;

      return (
        <div {...common} role="radiogroup" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: count }, (_, index) => index + 1).map((point) => {
              const selected = current === point;
              const filled = style === "STAR" && point <= current;
              return (
                <button
                  key={point}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={String(point)}
                  disabled={disabled}
                  onClick={() => onChange(point)}
                  className={[
                    "flex size-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors",
                    selected
                      ? "border-[var(--form-accent)] bg-[var(--form-accent)] text-[var(--form-accent-fg)]"
                      : "border-[var(--form-border)] bg-[var(--form-surface)] text-[var(--form-text)]",
                  ].join(" ")}
                >
                  {style === "STAR" ? (
                    <StarIcon
                      className="size-5"
                      fill={filled ? "currentColor" : "none"}
                    />
                  ) : (
                    point
                  )}
                </button>
              );
            })}
          </div>
          {(lowLabel || highLabel) && (
            <div className="flex justify-between text-xs text-[var(--form-muted)]">
              <span>{lowLabel}</span>
              <span>{highLabel}</span>
            </div>
          )}
        </div>
      );
    }

    case "ADDRESS": {
      const { fields } = asRecord(settings) as { fields?: string[] };
      const enabled = fields?.length ? ADDRESS_FIELDS.filter((f) => fields.includes(f.key)) : ADDRESS_FIELDS;
      const current = asRecord(value ?? {}) as Record<string, string>;

      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {enabled.map((field, index) => (
            <div
              key={field.key}
              className={index === 0 ? "sm:col-span-2" : undefined}
            >
              <label
                htmlFor={`${id}-${field.key}`}
                className="mb-1.5 block text-sm text-[var(--form-text)]"
              >
                {field.label}
              </label>
              <input
                {...common}
                id={`${id}-${field.key}`}
                type={field.type}
                autoComplete={field.autoComplete}
                className={controlClass}
                value={current[field.key] ?? ""}
                onChange={(event) =>
                  onChange({ ...current, [field.key]: event.target.value })
                }
              />
            </div>
          ))}
        </div>
      );
    }

    default:
      return (
        <input
          {...common}
          type="text"
          className={controlClass}
          placeholder={placeholder ?? undefined}
          maxLength={(asRecord(settings) as TextSettings).maxLength}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
