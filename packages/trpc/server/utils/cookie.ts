import type { CookieOptions, Request, Response } from "express";

import { UNLOCK_TTL_MS } from "@repo/services/utils/signed-token";

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 12 * ONE_MONTH;

export interface CookieConfig {
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  /** Shared parent domain, e.g. ".example.com". Omit for host-only cookies. */
  domain?: string;
}

/**
 * The attributes every cookie on this API shares. Callers may override them
 * per-cookie; `clearCookie` must use the same `path`/`domain` as the setter or
 * the browser will keep the original cookie.
 */
function baseCookieOptions(config: CookieConfig): CookieOptions {
  return {
    path: "/",
    httpOnly: true,
    secure: config.secure,
    sameSite: config.sameSite,
    ...(config.domain ? { domain: config.domain } : {}),
  };
}

export function createCookieFactory(res: Response, config: CookieConfig) {
  const base = baseCookieOptions(config);

  return function createCookie(
    name: string,
    value: string,
    opts: CookieOptions = {},
  ): void {
    res.cookie(name, value, { ...base, maxAge: ONE_YEAR, ...opts });
  };
}

export function getCookieFactory(req: Request) {
  return function getCookie(name: string): string | undefined {
    return req.cookies?.[name];
  };
}

export function clearCookieFactory(res: Response, config: CookieConfig) {
  const base = baseCookieOptions(config);

  return function clearCookie(name: string, opts: CookieOptions = {}): void {
    res.clearCookie(name, { ...base, ...opts });
  };
}

// ── Authentication cookie ──────────────────────────────────────────────────────
// The value is a signed JWT, so it is tamper-evident on its own.

const AUTHENTICATION_COOKIE_NAME = "authentication-token";

export function setAuthenticationCookie(
  ctx: {
    createCookie: (name: string, value: string, opts?: CookieOptions) => void;
  },
  accessToken: string,
) {
  ctx.createCookie(AUTHENTICATION_COOKIE_NAME, accessToken);
}

export function getAuthenticationCookie(ctx: {
  getCookie: (name: string) => string | undefined;
}): string | undefined {
  return ctx.getCookie(AUTHENTICATION_COOKIE_NAME);
}

export function clearAuthenticationCookie(ctx: {
  clearCookie: (name: string, opts?: CookieOptions) => void;
}) {
  ctx.clearCookie(AUTHENTICATION_COOKIE_NAME);
}

// ── Form unlock cookie ─────────────────────────────────────────────────────────

/**
 * A cookie per form, holding the unlock token for that form.
 *
 * Without it, a respondent who unlocked a protected form would lose access on every
 * refresh: the token would live in client state, the server component would still see a
 * locked form, and a reload would send them back to the password prompt with their answers
 * still on the device.
 *
 * The token is HMAC-signed, scoped to one form id, and carries its own expiry — so the
 * cookie cannot be forged, cannot unlock a different form, and stops working on its own.
 * The cookie's own `maxAge` matches that expiry so a dead one does not linger.
 *
 * Named by slug, not by id, because the public route is addressed by slug and does not know
 * the id until the form has been read.
 */
export const unlockCookieName = (slug: string) => `form-unlock-${slug}`;

export function setFormUnlockCookie(
  ctx: {
    createCookie: (name: string, value: string, opts?: CookieOptions) => void;
  },
  slug: string,
  token: string,
) {
  ctx.createCookie(unlockCookieName(slug), token, {
    // Not httpOnly: the public form's own components pass the token on explicitly, and it
    // grants nothing beyond what the signed token already permits.
    httpOnly: false,
    maxAge: UNLOCK_TTL_MS,
  });
}

export function getFormUnlockCookie(
  ctx: { getCookie: (name: string) => string | undefined },
  slug: string,
): string | undefined {
  return ctx.getCookie(unlockCookieName(slug));
}

export function clearFormUnlockCookie(
  ctx: { clearCookie: (name: string, opts?: CookieOptions) => void },
  slug: string,
) {
  ctx.clearCookie(unlockCookieName(slug), { httpOnly: false });
}
