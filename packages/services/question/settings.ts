import { z } from "zod";

import { questionKindSchema, type QuestionKind } from "./model";

/**
 * Per-kind configuration and validation for a question, stored in
 * `questions.settings`.
 *
 * This module is the single definition of that shape. The tRPC input validates
 * against it, the service re-validates against it, and the builder renders its
 * config controls from it — so a question can never be created in a state the
 * respondent renderer would not know how to display.
 */

// ── Shared building blocks ─────────────────────────────────────────────────────

export const questionOptionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, "Option id may contain lowercase letters, digits, - and _"),
  label: z.string().min(1).max(200),
});

export type QuestionOption = z.infer<typeof questionOptionSchema>;

/** At least two options, or the question cannot be answered. */
export const questionOptionsSchema = z
  .array(questionOptionSchema)
  .min(2, "A choice question needs at least two options")
  .max(50)
  .refine(
    (options) => new Set(options.map((option) => option.id)).size === options.length,
    "Option ids must be unique",
  );

/**
 * A hostname, e.g. `example.com`. Not an email address — that is a separate mistake
 * worth avoiding, since `z.email()` would reject every domain.
 */
export const domainSchema = z
  .string()
  .min(3)
  .max(255)
  .toLowerCase()
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    "Must be a domain name such as example.com",
  );

export const addressFieldSchema = z.enum([
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
  "country",
]);

export type AddressField = z.infer<typeof addressFieldSchema>;

/** Shared numeric bounds. */
const min = z.number().finite();
const max = z.number().finite();

// ── Per-kind settings ──────────────────────────────────────────────────────────

const noSettings = z.object({}).strict();

const textSettings = z
  .object({
    minLength: z.number().int().min(0).max(10_000).optional(),
    maxLength: z.number().int().min(1).max(10_000).optional(),
    /** JavaScript-compatible regular expression source, anchored by the validator. */
    pattern: z.string().max(500).optional(),
  })
  .strict()
  .refine(
    (settings) =>
      settings.minLength === undefined ||
      settings.maxLength === undefined ||
      settings.minLength <= settings.maxLength,
    { message: "minLength must not exceed maxLength", path: ["minLength"] },
  )
  .refine((settings) => !settings.pattern || isValidPattern(settings.pattern), {
    message: "pattern must be a valid regular expression",
    path: ["pattern"],
  });

const numberSettings = z
  .object({
    min: min.optional(),
    max: max.optional(),
    integer: z.boolean().optional(),
  })
  .strict()
  .refine(
    (settings) => settings.min === undefined || settings.max === undefined || settings.min <= settings.max,
    { message: "min must not exceed max", path: ["min"] },
  );

const emailSettings = z
  .object({
    /** When set, only these domains are accepted. Subdomains must be listed explicitly. */
    allowedDomains: z.array(domainSchema).max(50).optional(),
  })
  .strict();

const phoneSettings = z
  .object({
    /** ISO 3166-1 alpha-2, e.g. "IN". Informational: the validator accepts E.164-ish input. */
    country: z.string().length(2).toUpperCase().optional(),
  })
  .strict();

const choiceSettings = z
  .object({
    options: questionOptionsSchema,
    randomize: z.boolean().optional(),
    /** Only meaningful for MULTI_CHOICE. */
    minSelected: z.number().int().min(1).optional(),
    maxSelected: z.number().int().min(1).optional(),
  })
  .strict()
  .refine(
    (settings) =>
      settings.minSelected === undefined ||
      settings.maxSelected === undefined ||
      settings.minSelected <= settings.maxSelected,
    { message: "minSelected must not exceed maxSelected", path: ["minSelected"] },
  )
  .refine(
    (settings) => settings.maxSelected === undefined || settings.maxSelected <= settings.options.length,
    { message: "maxSelected cannot exceed the number of options", path: ["maxSelected"] },
  );

const ratingSettings = z
  .object({
    scale: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(10)]),
    style: z.enum(["STAR", "NUMBER"]).default("STAR"),
    lowLabel: z.string().max(60).optional(),
    highLabel: z.string().max(60).optional(),
  })
  .strict();

const dateSettings = z
  .object({
    min: z.iso.date().optional(),
    max: z.iso.date().optional(),
  })
  .strict()
  .refine(
    (settings) => settings.min === undefined || settings.max === undefined || settings.min <= settings.max,
    { message: "min must not exceed max", path: ["min"] },
  );

const addressSettings = z
  .object({
    fields: z.array(addressFieldSchema).min(1).max(6).optional(),
  })
  .strict();

/** Every kind, including the ones that take no configuration. */
export const questionSettingsByKind = {
  SHORT_TEXT: textSettings,
  LONG_TEXT: textSettings,
  PASSWORD: textSettings,
  NUMBER: numberSettings,
  EMAIL: emailSettings,
  PHONE: phoneSettings,
  YES_NO: noSettings,
  SINGLE_CHOICE: choiceSettings,
  MULTI_CHOICE: choiceSettings,
  DROPDOWN: choiceSettings,
  RATING: ratingSettings,
  DATE: dateSettings,
  ADDRESS: addressSettings,
} satisfies Record<QuestionKind, z.ZodType>;

/** The kind of a settings object, inferred from the map above. */
export type QuestionSettings<K extends QuestionKind = QuestionKind> = z.infer<
  (typeof questionSettingsByKind)[K]
>;

/**
 * A full question configuration: the kind plus its settings, validated together.
 * A discriminated union over `kind`, so narrowing the kind narrows the settings.
 */
export const questionConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SHORT_TEXT"), settings: textSettings }),
  z.object({ kind: z.literal("LONG_TEXT"), settings: textSettings }),
  z.object({ kind: z.literal("PASSWORD"), settings: textSettings }),
  z.object({ kind: z.literal("NUMBER"), settings: numberSettings }),
  z.object({ kind: z.literal("EMAIL"), settings: emailSettings }),
  z.object({ kind: z.literal("PHONE"), settings: phoneSettings }),
  z.object({ kind: z.literal("YES_NO"), settings: noSettings }),
  z.object({ kind: z.literal("SINGLE_CHOICE"), settings: choiceSettings }),
  z.object({ kind: z.literal("MULTI_CHOICE"), settings: choiceSettings }),
  z.object({ kind: z.literal("DROPDOWN"), settings: choiceSettings }),
  z.object({ kind: z.literal("RATING"), settings: ratingSettings }),
  z.object({ kind: z.literal("DATE"), settings: dateSettings }),
  z.object({ kind: z.literal("ADDRESS"), settings: addressSettings }),
]);

export type QuestionConfig = z.infer<typeof questionConfigSchema>;

/** The default settings for a kind, used when a question is first created. */
export function defaultSettingsFor(kind: QuestionKind): QuestionSettings {
  switch (kind) {
    case "RATING":
      return { scale: 5, style: "STAR" } as QuestionSettings;
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
    case "DROPDOWN":
      // Two placeholder options; the creator replaces them in the builder.
      return { options: [{ id: "option-1", label: "Option 1" }, { id: "option-2", label: "Option 2" }] } as QuestionSettings;
    case "ADDRESS":
      return { fields: ["line1", "city", "postalCode", "country"] } as QuestionSettings;
    default:
      return {} as QuestionSettings;
  }
}

/**
 * Validates `settings` for `kind`, returning the parsed value with defaults
 * applied. Throws a `BadRequestError` on failure so the caller never has to
 * inspect a result union.
 */
export function parseSettingsFor<K extends QuestionKind>(
  kind: K,
  settings: unknown,
): QuestionSettings<K> {
  const result = questionSettingsByKind[kind].safeParse(settings ?? {});

  if (!result.success) {
    throw new SettingsError(kind, result.error);
  }

  return result.data as QuestionSettings<K>;
}

export class SettingsError extends Error {
  readonly kind: QuestionKind;
  readonly issues: z.core.$ZodIssue[];

  constructor(kind: QuestionKind, error: z.ZodError) {
    super(`Invalid settings for a ${kind} question`);
    this.name = "SettingsError";
    this.kind = kind;
    this.issues = error.issues;
  }
}

function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export { questionKindSchema };
