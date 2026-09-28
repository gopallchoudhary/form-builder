"use client";

import { GripVerticalIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Field, FieldLabel } from "~/components/ui/field";
import type { QuestionKind } from "@repo/services/question/model";

/**
 * The per-kind configuration editors, driven by `questionSettingsByKind` on the server.
 *
 * Nothing here invents a rule: each control writes one field of the settings union that
 * the service already validates. That is what makes it impossible to build a question the
 * respondent renderer would not know how to display — the union is the contract, and the
 * builder is just an editor for it.
 */

type Settings = Record<string, unknown>;

const readOptions = (settings: Settings) =>
  Array.isArray(settings.options)
    ? (settings.options as Array<{ id: string; label: string }>)
    : [];

const ADDRESS_FIELDS = [
  { key: "line1", label: "Address" },
  { key: "line2", label: "Apartment, suite" },
  { key: "city", label: "City" },
  { key: "state", label: "State / region" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
] as const;

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
        className="h-9"
      />
    </Field>
  );
}

function OptionsEditor({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  const options = readOptions(settings);

  const set = (next: Array<{ id: string; label: string }>) =>
    onChange({ ...settings, options: next });

  const add = () => {
    // Ids are slugs, so they stay short, url-safe and stable in exports.
    let n = options.length + 1;
    while (options.some((option) => option.id === `option-${n}`)) n += 1;
    set([...options, { id: `option-${n}`, label: `Option ${n}` }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Options</Label>
        <Button size="sm" variant="outline" onClick={add}>
          <PlusIcon className="size-3.5" />
          Add option
        </Button>
      </div>

      {options.length < 2 && (
        <p className="text-muted-foreground text-xs">
          A choice question needs at least two options before it can be published.
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {options.map((option, index) => (
          <li key={option.id} className="flex items-center gap-1.5">
            <GripVerticalIcon className="text-muted-foreground/50 size-3.5 shrink-0" />
            <Input
              value={option.label}
              aria-label={`Option ${index + 1}`}
              onChange={(event) =>
                set(
                  options.map((entry, position) =>
                    position === index ? { ...entry, label: event.target.value } : entry,
                  ),
                )
              }
              className="h-9"
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove option ${index + 1}`}
              className="hover:text-destructive"
              onClick={() => set(options.filter((_, position) => position !== index))}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KindConfig({
  kind,
  settings,
  onChange,
}: {
  kind: QuestionKind;
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...settings, [key]: value });

  switch (kind) {
    case "SHORT_TEXT":
    case "LONG_TEXT":
    case "PASSWORD":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="minLength"
            label="Minimum length"
            min={0}
            value={settings.minLength as number | undefined}
            onChange={(value) => set("minLength", value)}
          />
          <NumberField
            id="maxLength"
            label="Maximum length"
            min={1}
            value={settings.maxLength as number | undefined}
            onChange={(value) => set("maxLength", value)}
          />
          <Field className="col-span-2">
            <FieldLabel htmlFor="pattern">Must match (regular expression)</FieldLabel>
            <Input
              id="pattern"
              value={(settings.pattern as string | undefined) ?? ""}
              onChange={(event) => set("pattern", event.target.value || undefined)}
              placeholder="^[A-Z].*$"
              className="h-9 font-mono text-xs"
            />
          </Field>
        </div>
      );

    case "NUMBER":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="min"
            label="Minimum"
            step={0.5}
            value={settings.min as number | undefined}
            onChange={(value) => set("min", value)}
          />
          <NumberField
            id="max"
            label="Maximum"
            step={0.5}
            value={settings.max as number | undefined}
            onChange={(value) => set("max", value)}
          />
          <div className="col-span-2">
            <Row label="Whole numbers only" hint="Rejects 1.5">
              <Switch
                checked={settings.integer === true}
                onCheckedChange={(checked) => set("integer", checked || undefined)}
              />
            </Row>
          </div>
        </div>
      );

    case "EMAIL": {
      const domains = Array.isArray(settings.allowedDomains)
        ? (settings.allowedDomains as string[])
        : [];
      return (
        <Field>
          <FieldLabel htmlFor="domains">Allowed domains</FieldLabel>
          <Input
            id="domains"
            value={domains.join(", ")}
            onChange={(event) =>
              set(
                "allowedDomains",
                event.target.value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              )
            }
            placeholder="example.com, corp.com"
            className="h-9"
          />
          <p className="text-muted-foreground text-xs">
            Leave empty to accept any address. Subdomains must be listed explicitly.
          </p>
        </Field>
      );
    }

    case "PHONE":
      return (
        <Field>
          <FieldLabel htmlFor="country">Country</FieldLabel>
          <Input
            id="country"
            value={(settings.country as string | undefined) ?? ""}
            maxLength={2}
            onChange={(event) => {
              const next = event.target.value.toUpperCase();
              set("country", next.length === 2 ? next : undefined);
            }}
            placeholder="IN"
            className="h-9 w-24 uppercase"
          />
          <p className="text-muted-foreground text-xs">
            Informational only. The validator accepts E.164-style input.
          </p>
        </Field>
      );

    case "YES_NO":
      return (
        <p className="text-muted-foreground text-sm">
          A yes/no question has nothing to configure.
        </p>
      );

    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
    case "DROPDOWN":
      return (
        <div className="flex flex-col gap-4">
          <OptionsEditor settings={settings} onChange={onChange} />
          {kind !== "SINGLE_CHOICE" && kind !== "DROPDOWN" && (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="minSelected"
                label="Choose at least"
                min={1}
                value={settings.minSelected as number | undefined}
                onChange={(value) => set("minSelected", value)}
              />
              <NumberField
                id="maxSelected"
                label="Choose at most"
                min={1}
                value={settings.maxSelected as number | undefined}
                onChange={(value) => set("maxSelected", value)}
              />
            </div>
          )}
          <Row label="Show options in a random order" hint="Useful against order bias">
            <Switch
              checked={settings.randomize === true}
              onCheckedChange={(checked) => set("randomize", checked || undefined)}
            />
          </Row>
        </div>
      );

    case "RATING": {
      const scale = (settings.scale as 3 | 5 | 7 | 10 | undefined) ?? 5;
      return (
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="scale">Scale</FieldLabel>
            <Select
              value={String(scale)}
              onValueChange={(value) => set("scale", Number(value))}
            >
              <SelectTrigger id="scale" className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} points
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Style</FieldLabel>
            <div className="flex gap-2">
              {(["STAR", "NUMBER"] as const).map((style) => (
                <Button
                  key={style}
                  size="sm"
                  variant={((settings.style as string | undefined) ?? "STAR") === style ? "default" : "outline"}
                  aria-pressed={((settings.style as string | undefined) ?? "STAR") === style}
                  onClick={() => set("style", style)}
                >
                  {style === "STAR" && <StarIcon className="size-3.5" />}
                  {style === "STAR" ? "Stars" : "Numbers"}
                </Button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="lowLabel">Lowest means</FieldLabel>
              <Input
                id="lowLabel"
                value={(settings.lowLabel as string | undefined) ?? ""}
                onChange={(event) => set("lowLabel", event.target.value || undefined)}
                placeholder="Poor"
                className="h-9"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="highLabel">Highest means</FieldLabel>
              <Input
                id="highLabel"
                value={(settings.highLabel as string | undefined) ?? ""}
                onChange={(event) => set("highLabel", event.target.value || undefined)}
                placeholder="Excellent"
                className="h-9"
              />
            </Field>
          </div>
        </div>
      );
    }

    case "DATE":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="minDate">Earliest date</FieldLabel>
            <Input
              id="minDate"
              type="date"
              value={(settings.min as string | undefined) ?? ""}
              onChange={(event) => set("min", event.target.value || undefined)}
              className="h-9"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="maxDate">Latest date</FieldLabel>
            <Input
              id="maxDate"
              type="date"
              value={(settings.max as string | undefined) ?? ""}
              onChange={(event) => set("max", event.target.value || undefined)}
              className="h-9"
            />
          </Field>
        </div>
      );

    case "ADDRESS": {
      const enabled = Array.isArray(settings.fields)
        ? (settings.fields as string[])
        : ADDRESS_FIELDS.map((field) => field.key);
      return (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Fields to ask for</Label>
          <ul className="flex flex-col gap-2">
            {ADDRESS_FIELDS.map((field) => {
              const checked = enabled.includes(field.key);
              return (
                <li key={field.key}>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(state) =>
                        set(
                          "fields",
                          state === true
                            ? [...enabled, field.key]
                            : enabled.filter((key) => key !== field.key),
                        )
                      }
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {enabled.length === 0 && (
            <p className="text-muted-foreground text-xs">
              An address question needs at least one field before it can be published.
            </p>
          )}
        </div>
      );
    }

    default:
      return (
        <p className="text-muted-foreground text-sm">
          This question has nothing to configure.
        </p>
      );
  }
}
