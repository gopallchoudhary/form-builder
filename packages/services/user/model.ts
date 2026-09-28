import { z } from "zod";

/**
 * `z.email()` validates the format *before* chained transforms run, so
 * `z.email().trim()` rejects `" a@b.com "` as malformed. Piping the normalised
 * string into `z.email()` validates after trimming and lowercasing instead.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

export const createUserWithEmailAndPasswordInput = z.object({
  fullName: z.string().trim().min(1).max(80).describe("Full name of the user"),
  email: email.describe("Email of the user"),
  password: z.string().min(8).max(128).describe("Password of the user"),
});

export type CreateUserWithEmailAndPasswordInputType = z.infer<
  typeof createUserWithEmailAndPasswordInput
>;

export const signInUserWithEmailAndPasswordInput = z.object({
  email: email.describe("Email of the user"),
  password: z.string().min(1).describe("Password of the user"),
});

export type SignInUserWithEmailAndPasswordInputType = z.infer<
  typeof signInUserWithEmailAndPasswordInput
>;

// ── Token ──────────────────────────────────────────────────────────────────────

export const generateUserTokenPayload = z.object({
  id: z.string().uuid(),
});

export type GenerateUserTokenPayloadType = z.infer<typeof generateUserTokenPayload>;
