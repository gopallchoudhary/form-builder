import { analyticsRouter } from "./routes/analytics/route";
import { authRouter } from "./routes/auth/route";
import { formRouter } from "./routes/form/route";
import { formPageRouter } from "./routes/form-page/route";
import { pollRouter } from "./routes/poll/route";
import { publicRouter } from "./routes/public/route";
import { questionRouter } from "./routes/question/route";
import { responseRouter } from "./routes/response/route";
import { router } from "./trpc";

export const serverRouter = router({
  auth: authRouter,
  form: formRouter,
  formPage: formPageRouter,
  poll: pollRouter,
  public: publicRouter,
  question: questionRouter,
  response: responseRouter,
  analytics: analyticsRouter,
});

export { createContextFactory, type CookieConfig, type Context } from "./context";
export { appErrorToHttpStatus } from "./utils/errors";
export {
  attachRealtimeServer,
  detachRealtimeServer,
  emitPollResults,
  pollRoom,
  type PollResultsPayload,
} from "./realtime";
export {
  RATE_LIMITS,
  resetRateLimits,
  setRateLimitStore,
  type RateLimitPolicy,
  type RateLimitStore,
} from "./utils/rate-limit";

export type ServerRouter = typeof serverRouter;
