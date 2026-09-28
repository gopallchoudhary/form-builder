import { accessService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  getFormBySlugInputModel,
  getFormBySlugOutputSchema,
  getSessionInputModel,
  getSessionOutputSchema,
  saveDraftInputModel,
  saveDraftOutputSchema,
  startSessionInputModel,
  startSessionOutputSchema,
  submitFormInputModel,
  submitFormOutputSchema,
  unlockFormInputModel,
  unlockFormOutputSchema,
} from "./model";

import { publicProcedure, router, sensitivePublicProcedure } from "../../trpc";

const TAGS = ["Public"];
const getPath = generatePath("/public/form");

/**
 * The respondent-facing surface. Every procedure here is reachable without a session, so
 * every one is rate limited and none of them may trust anything about the caller beyond
 * the device id it presents.
 */
export const publicRouter = router({
  getFormBySlug: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getFormBySlug"),
        tags: TAGS,
        protect: false,
        summary: "Open a form by its share slug",
      },
    })
    .input(getFormBySlugInputModel)
    .output(getFormBySlugOutputSchema)
    .query(({ input }) => accessService.getPublicFormBySlug(input)),

  /** Tight limit: this is the password-guessing surface. */
  unlockForm: sensitivePublicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/unlockForm"),
        tags: TAGS,
        protect: false,
        summary: "Check a form's password and get an unlock token",
      },
    })
    .input(unlockFormInputModel)
    .output(unlockFormOutputSchema)
    .mutation(({ input }) => accessService.unlock(input)),

  startSession: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/startSession"),
        tags: TAGS,
        protect: false,
        summary: "Start filling a form, or resume an unfinished attempt",
      },
    })
    .input(startSessionInputModel)
    .output(startSessionOutputSchema)
    .mutation(({ input }) => accessService.startSession(input)),

  getSession: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getSession"),
        tags: TAGS,
        protect: false,
        summary: "Read back a session's saved answers",
      },
    })
    .input(getSessionInputModel)
    .output(getSessionOutputSchema)
    .query(({ input }) => accessService.getSession(input)),

  saveDraft: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/saveDraft"),
        tags: TAGS,
        protect: false,
        summary: "Save answers as the respondent goes",
      },
    })
    .input(saveDraftInputModel)
    .output(saveDraftOutputSchema)
    .mutation(({ input }) => accessService.saveDraft(input)),

  /** Tight limit: submissions are the expensive write and the spam target. */
  submitForm: sensitivePublicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/submitForm"),
        tags: TAGS,
        protect: false,
        summary: "Submit a response",
      },
    })
    .input(submitFormInputModel)
    .output(submitFormOutputSchema)
    .mutation(({ input }) => accessService.submit(input)),
});
