import { initTRPC, TRPCError } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";

import type { Context } from "./context";
import { getAuthenticationCookie } from "./utils/cookie";
import { RATE_LIMITS, createRateLimiter } from "./utils/rate-limit";
import { userService } from "./services";

/** Message used whenever an unexpected failure would otherwise leak internals. */
const SCRUBBED_MESSAGE = "Something went wrong. Please try again.";

export const tRPCContext = initTRPC
  .meta<OpenApiMeta>()
  .context<Context>()
  .create({
    errorFormatter({ shape, error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        return { ...shape, message: SCRUBBED_MESSAGE };
      }
      return shape;
    },
  });

export const router = tRPCContext.router;

const baseProcedure = tRPCContext.procedure;

/** A procedure that carries its own rate-limit policy. */
function withRateLimit(policy: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]) {
  const consume = createRateLimiter(policy);

  return baseProcedure.use(
    tRPCContext.middleware(async (opts) => {
      await consume(opts.ctx.clientIp ?? "unknown");
      return opts.next();
    }),
  );
}

/** Open to the public, rate limited so one caller cannot flood the API. */
export const publicProcedure = withRateLimit(RATE_LIMITS.public);

/**
 * For anything an unauthenticated caller can retry against — a password, a submission.
 * Tight enough that guessing a form password is not practical.
 */
export const sensitivePublicProcedure = withRateLimit(RATE_LIMITS.sensitive);

/** Requires a valid session cookie, and is not rate limited on IP. */
export const authenticatedProcedure = baseProcedure.use(async (opts) => {
  const { ctx } = opts;

  const token = getAuthenticationCookie(ctx);
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in" });
  }

  const { id } = await userService.verifyAndDecodeUserToken(token);

  return opts.next({ ctx: { ...ctx, user: { id } } });
});
