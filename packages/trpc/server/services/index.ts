import AccessService from "@repo/services/access";
import AnalyticsService from "@repo/services/analytics";
import FormPageService from "@repo/services/form-page";
import FormService from "@repo/services/form";
import QuestionService from "@repo/services/question";
import ResponseService from "@repo/services/response";
import UserService from "@repo/services/user";

import { toTRPCError } from "../utils/errors";

/**
 * Wraps a service so every method converts a service-layer `AppError` into a typed
 * tRPC error.
 *
 * The conversion cannot live in a procedure middleware: tRPC v11's `callRecursive`
 * catches every error and returns it as a *value* (`{ ok: false, error }`), re-throwing
 * only after the whole chain has unwound. A middleware's `await next()` therefore never
 * rejects, so a `try`/`catch` around it cannot see a service error, and every typed error
 * would reach the client as an opaque 500.
 *
 * Decorating the instances puts it at the one place every procedure already goes through,
 * so a procedure cannot forget it — the failure mode of the obvious alternative
 * (`try`/`catch` in each resolver) is a silent 500 in code written six months from now.
 */
function typedService<T extends object>(service: T): T {
  return new Proxy(service, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        const rethrow = (error: unknown): never => {
          throw toTRPCError(error);
        };

        try {
          const result = value.apply(target, args);
          // A service method can be async or not; both have to be covered.
          return result instanceof Promise ? result.catch(rethrow) : result;
        } catch (error) {
          return rethrow(error);
        }
      };
    },
  });
}

export const userService = typedService(new UserService());
export const formService = typedService(new FormService());
export const formPageService = typedService(new FormPageService());
export const questionService = typedService(new QuestionService());
export const responseService = typedService(new ResponseService());
export const analyticsService = typedService(new AnalyticsService());
export const accessService = typedService(new AccessService());
