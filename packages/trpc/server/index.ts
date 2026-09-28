import { authRouter } from "./routes/auth/route";
import { formRouter } from "./routes/form/route";
import { router } from "./trpc";

export const serverRouter = router({
  auth: authRouter,
  form: formRouter,
});

export { createContextFactory, type CookieConfig, type Context } from "./context";
export { appErrorToHttpStatus } from "./utils/errors";

export type ServerRouter = typeof serverRouter;
