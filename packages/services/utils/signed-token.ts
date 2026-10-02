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
 *
 * The unlock payload binds the password as well as the form, so a rotated password revokes
 * the tokens issued under the old one.
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

const unlockPayloadSchema = z.string().regex(/^\d+:[a-f0-9-]{36}:[A-Za-z0-9_-]{16}:\d+$/);

/**
 * A short value identifying one version of one form's password.
 *
 * The stored hash is already exactly that, and for free: `hashPassword` salts randomly, so
 * setting the same password twice produces two different hashes. Signing a fingerprint of it
 * rather than the hash itself means the value carries no information — it cannot be used to
 * test a password against, and it is useless if it ever leaks.
 *
 * `null` is the open form, and gets its own fingerprint rather than a sentinel token. That
 * makes the transition safe in both directions: unlocking a form while it is open issues a
 * token bound to "no password", and setting a password later invalidates it along with every
 * other token, instead of leaving one that quietly carries access to a now-protected form.
 *
 * Truncated to 16 characters. This only has to distinguish one hash from another, and a short
 * value keeps the cookie small.
 */
export function passwordFingerprint(passwordHash: string | null): string {
  return hmac(passwordHash ?? "")
    .replace(/[=]/g, "")
    .slice(0, 16);
}

/**
 * A token proving the password for `formId` was supplied before `expiresAt`.
 *
 * Bound to the password hash as well as the form, so that changing the password revokes every
 * token already issued. Without that, rotating a password — usually because it was seen by
 * someone who should not have it — did nothing to anyone already holding a token or cookie,
 * for the full TTL.
 */
export function issueUnlockToken(
  formId: string,
  passwordHash: string | null,
  now = Date.now(),
): string {
  const fingerprint = passwordFingerprint(passwordHash);
  const payload = unlockPayloadSchema.parse(
    `${now}:${formId}:${fingerprint}:${now + UNLOCK_TTL_MS}`,
  );
  return sign(payload);
}

/**
 * True when the token was signed by us, is for this form and this version of its password,
 * and has not expired.
 *
 * A token issued against a previous password fails on the fingerprint, which is the point. It
 * cannot be distinguished from a forged or expired one, and that is deliberate: the only
 * answer a caller gets is no.
 */
export function verifyUnlockToken(
  token: string | undefined,
  formId: string,
  passwordHash: string | null,
  now = Date.now(),
): boolean {
  const payload = verifySignedValue(token);
  if (!payload) return false;

  const parsed = unlockPayloadSchema.safeParse(payload);
  if (!parsed.success) return false;

  const [, tokenFormId, fingerprint, expiresAt] = parsed.data.split(":");
  if (!tokenFormId || !fingerprint || !expiresAt) return false;
  if (tokenFormId !== formId) return false;
  if (Number(expiresAt) <= now) return false;

  // Constant-time: two fixed-width values, so no length or content leaks through timing.
  const expected = Buffer.from(passwordFingerprint(passwordHash));
  const actual = Buffer.from(fingerprint);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
