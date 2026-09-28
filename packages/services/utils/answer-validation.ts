import { z } from "zod";

import { type QuestionKind } from "../question/model";
import {
  type QuestionOption,
  type QuestionSettings,
  parseSettingsFor,
} from "../question/settings";

/**
 * Validates a respondent's answer and normalises it into the typed columns of
 * `form_answers`.
 *
 * The mapping is fixed per kind, and analytics depend on it, so it is defined once
 * here rather than in each caller:
 *
 *   text kinds, choices, yes/no  → value_text
 *   NUMBER, RATING              → value_number
 *   DATE                        → value_date  (a `YYYY-MM-DD` string, never a Date,
 *                                           so no timezone can shift the day)
 *   MULTI_CHOICE, ADDRESS       → value_json
 */

export interface NormalizedAnswer {
  valueText: string | null;
  valueNumber: string | null;
  valueDate: string | null;
  valueJson: unknown;
}

export const EMPTY_ANSWER: NormalizedAnswer = {
  valueText: null,
  valueNumber: null,
  valueDate: null,
  valueJson: null,
};

export type AnswerValidationResult =
  | { success: true; answer: NormalizedAnswer }
  | { success: false; message: string };

// ── Per-kind validators ────────────────────────────────────────────────────────

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Digits, spaces and the usual separators. Deliberately permissive about format. */
const PHONE = /^\+?[\d\s().-]{6,25}$/;

function textAnswer(settings: QuestionSettings, raw: unknown): AnswerValidationResult {
  if (typeof raw !== "string") {
    return { success: false, message: "Expected a text value" };
  }

  const value = raw.trim();
  const { minLength, maxLength, pattern } = settings as {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };

  if (minLength !== undefined && value.length < minLength) {
    return { success: false, message: `Must be at least ${minLength} characters` };
  }
  if (maxLength !== undefined && value.length > maxLength) {
    return { success: false, message: `Must be at most ${maxLength} characters` };
  }
  if (pattern !== undefined && !new RegExp(`^(?:${pattern})$`).test(value)) {
    return { success: false, message: "Does not match the expected format" };
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueText: value } };
}

function emailAnswer(
  settings: QuestionSettings,
  raw: unknown,
): AnswerValidationResult {
  const parsed = z.email().safeParse(typeof raw === "string" ? raw.trim() : raw);
  if (!parsed.success) {
    return { success: false, message: "Enter a valid email address" };
  }

  const { allowedDomains } = settings as { allowedDomains?: string[] };
  if (allowedDomains?.length) {
    const domain = parsed.data.split("@")[1]?.toLowerCase();
    if (!domain || !allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
      return { success: false, message: "That email domain is not accepted" };
    }
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueText: parsed.data } };
}

function phoneAnswer(raw: unknown): AnswerValidationResult {
  if (typeof raw !== "string" || !PHONE.test(raw.trim())) {
    return { success: false, message: "Enter a valid phone number" };
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueText: raw.trim() } };
}

function numberAnswer(
  settings: QuestionSettings,
  raw: unknown,
): AnswerValidationResult {
  const parsed = z.coerce.number().finite().safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Enter a number" };
  }

  const value = parsed.data;
  const { min, max, integer } = settings as {
    min?: number;
    max?: number;
    integer?: boolean;
  };

  if (integer && !Number.isInteger(value)) {
    return { success: false, message: "Enter a whole number" };
  }
  if (min !== undefined && value < min) {
    return { success: false, message: `Must be at least ${min}` };
  }
  if (max !== undefined && value > max) {
    return { success: false, message: `Must be at most ${max}` };
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueNumber: value.toString() } };
}

function ratingAnswer(
  settings: QuestionSettings,
  raw: unknown,
): AnswerValidationResult {
  const parsed = z.coerce.number().int().safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Choose a rating" };
  }

  const { scale } = settings as { scale: number };
  if (parsed.data < 1 || parsed.data > scale) {
    return { success: false, message: `Choose a rating between 1 and ${scale}` };
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueNumber: parsed.data.toString() } };
}

function dateAnswer(settings: QuestionSettings, raw: unknown): AnswerValidationResult {
  if (typeof raw !== "string" || !DATE_ONLY.test(raw)) {
    return { success: false, message: "Enter a date as YYYY-MM-DD" };
  }

  // Reject dates like 2026-02-31 that match the pattern but are not real.
  const parsed = z.iso.date().safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "That date does not exist" };
  }

  const { min, max } = settings as { min?: string; max?: string };
  if (min !== undefined && raw < min) {
    return { success: false, message: `Must be on or after ${min}` };
  }
  if (max !== undefined && raw > max) {
    return { success: false, message: `Must be on or before ${max}` };
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueDate: raw } };
}

function yesNoAnswer(raw: unknown): AnswerValidationResult {
  if (typeof raw !== "boolean") {
    return { success: false, message: "Choose yes or no" };
  }

  // Stored as text so a plain GROUP BY counts the answers.
  return { success: true, answer: { ...EMPTY_ANSWER, valueText: raw ? "true" : "false" } };
}

function optionLabel(options: QuestionOption[], value: string): string | undefined {
  return options.find((option) => option.id === value)?.label;
}

function singleChoiceAnswer(
  settings: QuestionSettings,
  raw: unknown,
): AnswerValidationResult {
  if (typeof raw !== "string") {
    return { success: false, message: "Choose one option" };
  }

  const { options } = settings as { options: QuestionOption[] };
  if (!optionLabel(options, raw)) {
    return { success: false, message: "That option is not available" };
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueText: raw } };
}

function multiChoiceAnswer(
  settings: QuestionSettings,
  raw: unknown,
): AnswerValidationResult {
  if (!Array.isArray(raw)) {
    return { success: false, message: "Choose one or more options" };
  }

  const { options, minSelected, maxSelected } = settings as {
    options: QuestionOption[];
    minSelected?: number;
    maxSelected?: number;
  };

  const selected = raw.filter((value): value is string => typeof value === "string");
  if (selected.length !== raw.length) {
    return { success: false, message: "That option is not available" };
  }
  if (new Set(selected).size !== selected.length) {
    return { success: false, message: "The same option was selected twice" };
  }
  for (const value of selected) {
    if (!optionLabel(options, value)) {
      return { success: false, message: "That option is not available" };
    }
  }
  if (minSelected !== undefined && selected.length < minSelected) {
    return { success: false, message: `Choose at least ${minSelected}` };
  }
  if (maxSelected !== undefined && selected.length > maxSelected) {
    return { success: false, message: `Choose at most ${maxSelected}` };
  }

  return { success: true, answer: { ...EMPTY_ANSWER, valueJson: selected } };
}

const addressShape = z.object({
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().max(120).optional(),
});

function addressAnswer(settings: QuestionSettings, raw: unknown): AnswerValidationResult {
  const parsed = addressShape.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "That address is not valid" };
  }

  const { fields } = settings as { fields?: (keyof z.infer<typeof addressShape>)[] };
  if (fields?.length) {
    const missing = fields.filter((field) => !parsed.data[field]);
    if (missing.length > 0) {
      return { success: false, message: `Missing: ${missing.join(", ")}` };
    }
  }

  // Drop empty parts so exports and charts do not carry a wall of nulls.
  const value = Object.fromEntries(
    Object.entries(parsed.data).filter(([, entry]) => entry !== undefined && entry !== ""),
  );

  return { success: true, answer: { ...EMPTY_ANSWER, valueJson: value } };
}

// ── Public entry point ─────────────────────────────────────────────────────────

/**
 * Validates one answer. `settings` is the question's parsed settings; they are
 * re-parsed here so a caller cannot pass settings that do not belong to the kind.
 */
export function validateAnswer(
  kind: QuestionKind,
  settings: unknown,
  raw: unknown,
): AnswerValidationResult {
  let parsed: QuestionSettings;
  try {
    parsed = parseSettingsFor(kind, settings);
  } catch {
    return { success: false, message: "This question is misconfigured" };
  }

  switch (kind) {
    case "SHORT_TEXT":
    case "LONG_TEXT":
    case "PASSWORD":
      return textAnswer(parsed, raw);
    case "EMAIL":
      return emailAnswer(parsed, raw);
    case "PHONE":
      return phoneAnswer(raw);
    case "NUMBER":
      return numberAnswer(parsed, raw);
    case "RATING":
      return ratingAnswer(parsed, raw);
    case "DATE":
      return dateAnswer(parsed, raw);
    case "YES_NO":
      return yesNoAnswer(raw);
    case "SINGLE_CHOICE":
    case "DROPDOWN":
      return singleChoiceAnswer(parsed, raw);
    case "MULTI_CHOICE":
      return multiChoiceAnswer(parsed, raw);
    case "ADDRESS":
      return addressAnswer(parsed, raw);
  }
}

/** True when the answer represents "no answer" rather than a value. */
export function isEmptyAnswer(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === "string") return raw.trim() === "";
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === "object") return Object.keys(raw as object).length === 0;
  return false;
}

/**
 * Renders a stored `numeric` the way a person would write it.
 *
 * `value_number` is `numeric(20, 6)`, so a rating of 5 comes back as `"5.000000"`. That
 * is correct for storage and wrong in an export, a chart axis or a table cell, so the
 * trailing padding is trimmed as a string rather than via `Number` — going through a
 * double would quietly lose precision on a 14-digit value.
 */
export function formatNumericAnswer(value: string | null): string | null {
  if (value === null) return null;
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

/** The subset of a `form_answers` row needed to rebuild a client-side answer. */
export interface StoredAnswer {
  kind: QuestionKind;
  valueText: string | null;
  valueNumber: string | null;
  valueDate: string | null;
  valueJson: unknown;
}

/**
 * The inverse of `validateAnswer`: turns a stored row back into the value the renderer
 * works with, so a resumed draft hydrates without the client needing to know which
 * column a kind lives in.
 *
 * Kind-aware where the stored form is not the client's form — `YES_NO` is persisted as
 * the text "true"/"false" so it can be counted with a plain GROUP BY, but the renderer
 * needs an actual boolean.
 */
export function denormalizeAnswer(row: StoredAnswer): unknown {
  if (row.valueDate !== null) return row.valueDate;
  if (row.valueJson !== null) return row.valueJson;
  if (row.valueNumber !== null) {
    const parsed = Number(row.valueNumber);
    return Number.isNaN(parsed) ? row.valueNumber : parsed;
  }
  if (row.valueText !== null) {
    if (row.kind === "YES_NO") return row.valueText === "true";
    return row.valueText;
  }
  return null;
}
