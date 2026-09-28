import { z } from "zod";

// Input schemas are owned by the service layer — this module only re-exports them
// so route files keep a stable import surface.
export {
  createUserWithEmailAndPasswordInput as createUserWithEmailAndPasswordInputModel,
  signInUserWithEmailAndPasswordInput as signInUserWithEmailAndPasswordInputModel,
} from "@repo/services/user/model";

// ── Output schemas ─────────────────────────────────────────────────────────────

export const createUserWithEmailAndPasswordOutputModel = z.object({
  id: z.string().describe("Id of the user created"),
});

export const signInUserWithEmailAndPasswordOutputModel = z.object({
  id: z.string().describe("Id of the user signed in"),
});

export const signOutUserOutputModel = z.undefined().describe("undefined");

export const getLoggedInUserInfoInputModel = z.undefined();

export const getLoggedInUserInfoOutputModel = z.object({
  id: z.string().describe("Id of the user"),
  email: z.email().describe("email of the user"),
  fullName: z.string().describe("Fullname of the user"),
  profileImageUrl: z.string().describe("URL of the profile image").optional().nullable(),
});
