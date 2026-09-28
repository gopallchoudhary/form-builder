import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { env } from "../env";

/**
 * Small signed-token helper for first-party cookies.
 *
 * The session cookie already holds a signed JWT, and the form-unlock cookie only has
 * to prove "this browser already supplied the right password for this form". An HMAC
 * over a short payload is enough, and it means the value carries no information a
 * client could tamper with.
 */

const SEPARATOR = ".";

/** 30 days, after which the respondent is asked for the password again. */
export const UNLOCK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hmac(payload: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
}

function sign(payload: string): string {
  return `${payload}${SEPARATOR}${hmac(payload)}`;
}

/** Returns the payload, or null when the signature does not match. */
export function verifySignedValue(value: string | undefined): string | null {
  if (!value) return null;

  const index = value.lastIndexOf(SEPARATOR);
  if (index <= 0) return null;

  const payload = value.slice(0, index);
  const signature = value.slice(index + 1);
  const expected = hmac(payload);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;

  return timingSafeEqual(actualBuffer, expectedBuffer) ? payload : null;
}

const unlockPayloadSchema = z.string().regex(/^\d+:[a-f0-9-]{36}:\d+$/);

/** A token proving the password for `formId` was supplied before `expiresAt`. */
export function issueUnlockToken(formId: string, now = Date.now()): string {
  return sign(unlockPayloadSchema.parse(`${now}:${formId}:${now + UNLOCK_TTL_MS}`));
}

/** True when the token was signed by us, is for this form, and has not expired. */
export function verifyUnlockToken(token: string | undefined, formId: string, now = Date.now()): boolean {
  const payload = verifySignedValue(token);
  if (!payload) return false;

  const parsed = unlockPayloadSchema.safeParse(payload);
  if (!parsed.success) return false;

  const [, tokenFormId, expiresAt] = parsed.data.split(":");
  return tokenFormId === formId && Number(expiresAt) > now;
}
