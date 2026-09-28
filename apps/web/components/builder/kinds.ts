import type { QuestionKind } from "@repo/services/question/model";

/**
 * How each of the thirteen kinds is named in the builder.
 *
 * These are the names a creator recognises from other form tools, not the enum values —
 * a picker reading `SINGLE_CHOICE` is leaking the database at the person using it.
 */
export const KIND_LABELS: Record<QuestionKind, string> = {
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  EMAIL: "Email",
  PHONE: "Phone",
  PASSWORD: "Password",
  YES_NO: "Yes / no",
  SINGLE_CHOICE: "Single choice",
  MULTI_CHOICE: "Multiple choice",
  DROPDOWN: "Dropdown",
  RATING: "Rating",
  DATE: "Date",
  ADDRESS: "Address",
};

/** Grouped for the kind picker, so thirteen options are not one flat list. */
export const KIND_GROUPS: Array<{ label: string; kinds: QuestionKind[] }> = [
  {
    label: "Text",
    kinds: ["SHORT_TEXT", "LONG_TEXT", "EMAIL", "PHONE", "PASSWORD"],
  },
  { label: "Choice", kinds: ["YES_NO", "SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN"] },
  { label: "Number and date", kinds: ["NUMBER", "RATING", "DATE"] },
  { label: "Other", kinds: ["ADDRESS"] },
];

export const ALL_KINDS = Object.keys(KIND_LABELS) as QuestionKind[];
