import type { CookieOptions, Request, Response } from "express";

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
  ctx: { createCookie: (name: string, value: string) => void },
  accessToken: string,
): void {
  ctx.createCookie(AUTHENTICATION_COOKIE_NAME, accessToken);
}

export function getAuthenticationCookie(ctx: {
  getCookie: (name: string) => string | undefined;
}): string | undefined {
  return ctx.getCookie(AUTHENTICATION_COOKIE_NAME);
}

export function clearAuthenticationCookie(ctx: {
  clearCookie: (name: string) => void;
}): void {
  ctx.clearCookie(AUTHENTICATION_COOKIE_NAME);
}
