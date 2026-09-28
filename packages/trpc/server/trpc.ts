import { initTRPC, TRPCError } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";

import type { Context } from "./context";
import { getAuthenticationCookie } from "./utils/cookie";
import { toTRPCError } from "./utils/errors";
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

/**
 * Every procedure starts here so that service-layer `AppError`s become typed
 * tRPC errors in exactly one place.
 */
const baseProcedure = tRPCContext.procedure.use(
  tRPCContext.middleware(async (opts) => {
    try {
      return await opts.next();
    } catch (error) {
      throw toTRPCError(error);
    }
  }),
);

export const publicProcedure = baseProcedure;

export const authenticatedProcedure = baseProcedure.use(async (opts) => {
  const { ctx } = opts;

  const token = getAuthenticationCookie(ctx);
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in" });
  }

  const { id } = await userService.verifyAndDecodeUserToken(token);

  return opts.next({ ctx: { ...ctx, user: { id } } });
});
