import { userService } from "../../services";
import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  clearAuthenticationCookie,
  setAuthenticationCookie,
} from "../../utils/cookie";
import {
  createUserWithEmailAndPasswordInputModel,
  createUserWithEmailAndPasswordOutputModel,
  getLoggedInUserInfoInputModel,
  getLoggedInUserInfoOutputModel,
  signInUserWithEmailAndPasswordInputModel,
  signInUserWithEmailAndPasswordOutputModel,
  signOutUserOutputModel,
} from "./model";

const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

export const authRouter = router({
  //. create user
  createUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createUserWithEmailAndPassword"),
        tags: TAGS,
        summary: "Create an account and sign in",
      protect: false,
      },
    })
    .input(createUserWithEmailAndPasswordInputModel)
    .output(createUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id, token } = await userService.createUserWithEmailAndPassword(input);

      setAuthenticationCookie(ctx, token);

      return { id };
    }),

  //. sign in
  signinUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/signinUserWithEmailAndPassword"),
        tags: TAGS,
        summary: "Sign in with email and password",
      protect: false,
      },
    })
    .input(signInUserWithEmailAndPasswordInputModel)
    .output(signInUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id, token } = await userService.signInUserWithEmailAndPassword(input);

      setAuthenticationCookie(ctx, token);

      return { id };
    }),

  //. sign out — the session is a stateless JWT, so clearing the cookie is enough
  signOutUser: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/signOutUser"),
        tags: TAGS,
        summary: "Clear the session cookie",
      protect: false,
      },
    })
    /*
     * No input parser, deliberately — and not an oversight to be tidied up later.
     *
     * This used to declare `.input(z.undefined())`, which made the procedure impossible to
     * call over tRPC: `httpLink` sends no body for a void mutation, tRPC parses an absent
     * body as `{}`, and zod refuses an object where `undefined` was demanded. Every sign-out
     * from the app was a 400 and a session that would not end.
     *
     * The REST route went on working, which is why the tests missed it: they only ever
     * posted to `/api/authentication/signOutUser`. A procedure with no input parser accepts
     * both an empty body and `{}`, so the two transports now agree.
     */
    .output(signOutUserOutputModel)
    .mutation(async ({ ctx }) => {
      clearAuthenticationCookie(ctx);
    }),

  //. get logged in user info
  getLoggedInUserInfo: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getLoggedInUserInfo"),
        tags: TAGS,
        protect: true,
        summary: "Get the currently signed-in user",
      },
    })
    .input(getLoggedInUserInfoInputModel)
    .output(getLoggedInUserInfoOutputModel)
    .query(async ({ ctx }) => {
      return userService.getUserInfoById(ctx.user.id);
    }),
});
