import { z } from "zod";

import { questionKindSchema } from "../question/model";

// ── Reading a form ─────────────────────────────────────────────────────────────

export const getPublicFormInput = z.object({
  slug: z.string().min(1).max(64).describe("Share slug from the /f/[slug] URL"),
  /** A previously issued unlock token, if the form is password protected. */
  unlockToken: z.string().max(500).optional(),
});

export type GetPublicFormInputType = z.input<typeof getPublicFormInput>;

// ── Unlocking ──────────────────────────────────────────────────────────────────

export const unlockFormInput = z.object({
  slug: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export type UnlockFormInputType = z.input<typeof unlockFormInput>;

// ── Session bootstrap ──────────────────────────────────────────────────────────

export const startSessionInput = z.object({
  slug: z.string().min(1).max(64),
  /** Random id from the device cookie. Never the respondent's identity. */
  deviceId: z.string().uuid(),
  unlockToken: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});

export type StartSessionInputType = z.input<typeof startSessionInput>;

/** A single answer as the client sends it, before validation. */
export const rawAnswerSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.record(z.string(), z.string()), z.null()]);

/**
 * Draft save and submit both carry a set of answers keyed by question id. Only the
 * ids the client knows about are accepted; the server re-derives everything else.
 */
export const answersPayloadSchema = z
  .object({
    questionId: z.string().uuid(),
    value: rawAnswerSchema,
  })
  .refine((answer) => answer.value !== null, {
    message: "Send an empty string or an empty array to clear an answer",
  });

export const saveDraftInput = z.object({
  sessionId: z.string().uuid(),
  deviceId: z.string().uuid(),
  answers: z.array(answersPayloadSchema).max(200),
  /** Where the respondent is, so a resumed draft can pick up where it left off. */
  currentQuestionId: z.string().uuid().nullable().optional(),
  currentPageId: z.string().uuid().nullable().optional(),
});

export type SaveDraftInputType = z.input<typeof saveDraftInput>;

export const submitFormInput = z.object({
  sessionId: z.string().uuid(),
  deviceId: z.string().uuid(),
  /** Final answers. Anything omitted keeps the value already saved as a draft. */
  answers: z.array(answersPayloadSchema).max(200).optional(),
  /** Set when a respondent is deliberately going back to change a submitted answer. */
  allowResubmit: z.boolean().default(false),
});

export type SubmitFormInputType = z.input<typeof submitFormInput>;

export const getSessionInput = z.object({
  sessionId: z.string().uuid(),
  deviceId: z.string().uuid(),
});

export type GetSessionInputType = z.input<typeof getSessionInput>;

// ── Shapes returned to the renderer ────────────────────────────────────────────

export const publicQuestionSchema = z.object({
  id: z.string(),
  kind: questionKindSchema,
  label: z.string(),
  labelKey: z.string(),
  description: z.string().nullable(),
  placeholder: z.string().nullable(),
  isRequired: z.boolean(),
  settings: z.unknown(),
});

export const publicPageSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
});

export const publicFormSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  layoutMode: z.enum(["STEP", "PAGED"]),
  themeKey: z.string(),
  showProgress: z.boolean(),
  allowBack: z.boolean(),
  version: z.number().int(),
  thankYouTitle: z.string().nullable(),
  thankYouMessage: z.string().nullable(),
  thankYouRedirectUrl: z.string().nullable(),
  pages: z.array(publicPageSchema),
  questions: z.array(publicQuestionSchema),
});

export type PublicForm = z.infer<typeof publicFormSchema>;

/** Why the form cannot be shown, or null when it can. */
export const formAvailabilitySchema = z.enum([
  "NOT_FOUND",
  "NOT_PUBLISHED",
  "EXPIRED",
  "LIMIT_REACHED",
]);

export const getPublicFormOutputSchema = z.object({
  available: z.boolean(),
  /** Set when `available` is false, so the renderer can show the right screen. */
  reason: formAvailabilitySchema.nullable(),
  /** True when a password is still required. */
  locked: z.boolean(),
  form: publicFormSchema.nullable(),
});

export type GetPublicFormOutput = z.infer<typeof getPublicFormOutputSchema>;

export const unlockFormOutputSchema = z.object({
  /** True when the password matched. On success the caller stores the token. */
  unlocked: z.boolean(),
  /** Present on success only. */
  unlockToken: z.string().optional(),
  /** Present on failure only, so the form can explain what went wrong. */
  message: z.string().optional(),
});

export type UnlockFormOutput = z.infer<typeof unlockFormOutputSchema>;

export const startSessionOutputSchema = z.object({
  sessionId: z.string(),
  /** False when an existing in-progress draft was resumed. */
  created: z.boolean(),
  formVersion: z.number().int(),
  /** Whether this device has already submitted to this form. */
  alreadyCompleted: z.boolean(),
  answers: z.record(z.string(), rawAnswerSchema),
  currentPageId: z.string().nullable(),
  currentQuestionId: z.string().nullable(),
});

export type StartSessionOutput = z.infer<typeof startSessionOutputSchema>;

export const saveDraftOutputSchema = z.object({
  sessionId: z.string(),
  savedAt: z.string(),
});

export type SaveDraftOutput = z.infer<typeof saveDraftOutputSchema>;

export const submitFormOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("SUBMITTED") }),
  z.object({ status: z.literal("ALREADY_SUBMITTED") }),
  z.object({ status: z.literal("NOT_PUBLISHED") }),
  z.object({ status: z.literal("EXPIRED") }),
  z.object({ status: z.literal("LIMIT_REACHED") }),
  z.object({
    status: z.literal("INVALID"),
    /** questionId -> the first problem with that answer. */
    fieldErrors: z.record(z.string(), z.string()),
  }),
]);

export type SubmitFormOutput = z.infer<typeof submitFormOutputSchema>;

export const getSessionOutputSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]),
  answers: z.record(z.string(), rawAnswerSchema),
  currentPageId: z.string().nullable(),
  currentQuestionId: z.string().nullable(),
});

export type GetSessionOutput = z.infer<typeof getSessionOutputSchema>;
