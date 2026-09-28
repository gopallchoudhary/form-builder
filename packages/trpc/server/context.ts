import { randomUUID } from "node:crypto";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import {
  clearCookieFactory,
  createCookieFactory,
  getCookieFactory,
  type CookieConfig,
} from "./utils/cookie";

export type { CookieConfig };

export interface TRPCCtxUser {
  id: string;
}

export interface TRPCContext {
  createCookie: ReturnType<typeof createCookieFactory>;
  getCookie: ReturnType<typeof getCookieFactory>;
  clearCookie: ReturnType<typeof clearCookieFactory>;
  user?: TRPCCtxUser;
  clientIp: string | null;
  userAgent: string | null;
  requestId: string;
}

export type Context = TRPCContext;

/**
 * `apps/api` owns the environment, so it decides cookie security settings and
 * hands them in here. This keeps `@repo/trpc` free of any env dependency.
 */
export function createContextFactory(cookieConfig: CookieConfig) {
  return async function createContext({
    req,
    res,
  }: CreateExpressContextOptions): Promise<TRPCContext> {
    return {
      createCookie: createCookieFactory(res, cookieConfig),
      getCookie: getCookieFactory(req),
      clearCookie: clearCookieFactory(res, cookieConfig),
      user: undefined,
      clientIp: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
      requestId: (res.locals?.requestId as string | undefined) ?? randomUUID(),
    };
  };
}
