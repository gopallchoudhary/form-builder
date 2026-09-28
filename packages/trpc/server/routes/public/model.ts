import { z } from "zod";

export {
  getPublicFormInput as getFormBySlugInputModel,
  getSessionInput as getSessionInputModel,
  saveDraftInput as saveDraftInputModel,
  startSessionInput as startSessionInputModel,
  submitFormInput as submitFormInputModel,
  unlockFormInput as unlockFormInputModel,
} from "@repo/services/access/model";

export {
  getPublicFormOutputSchema as getFormBySlugOutputSchema,
  getSessionOutputSchema,
  saveDraftOutputSchema,
  startSessionOutputSchema,
  submitFormOutputSchema,
  unlockFormOutputSchema,
} from "@repo/services/access/model";

/** Re-exported so the route can re-declare the shape it stores in a cookie. */
export const unlockTokenOutputSchema = z.object({
  unlocked: z.boolean(),
  unlockToken: z.string().optional(),
  message: z.string().optional(),
});
