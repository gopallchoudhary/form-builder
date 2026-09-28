import { formService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  createFormInputModel,
  createFormOutputSchema,
  deleteFormInputModel,
  formOutputSchema,
  formSettingsOutputSchema,
  getFormInputModel,
  idOutputSchema,
  listFormsInputModel,
  listFormsOutputSchema,
  setFormPasswordInputModel,
  setFormStatusInputModel,
  setPasswordOutputSchema,
  slugOutputSchema,
  updateFormSettingsInputModel,
  updateFormSlugInputModel,
} from "./model";

import { authenticatedProcedure, router } from "../../trpc";

const TAGS = ["Form"];
const getPath = generatePath("/form");

export const formRouter = router({
  createForm: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createForm"),
        tags: TAGS,
        protect: true,
        summary: "Create a form",
      },
    })
    .input(createFormInputModel)
    .output(createFormOutputSchema)
    .mutation(({ input, ctx }) => formService.createForm(ctx.user.id, input)),

  listForms: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listForms"),
        tags: TAGS,
        protect: true,
        summary: "List the forms created by the signed-in user",
      },
    })
    .input(listFormsInputModel)
    .output(listFormsOutputSchema)
    .query(({ ctx }) => formService.listFormsByUserId({ userId: ctx.user.id })),

  /** The whole editable form. What the builder store hydrates from. */
  getForm: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getForm"),
        tags: TAGS,
        protect: true,
        summary: "Get one of your forms, with its pages and questions",
      },
    })
    .input(getFormInputModel)
    .output(formOutputSchema)
    .query(({ input, ctx }) => formService.getFullDefinition(ctx.user.id, input)),

  /** Settings only, for panels that do not need the pages and questions. */
  getFormSettings: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getFormSettings"),
        tags: TAGS,
        protect: true,
        summary: "Get the settings of one of your forms",
      },
    })
    .input(getFormInputModel)
    .output(formSettingsOutputSchema)
    .query(({ input, ctx }) => formService.getFormById(ctx.user.id, input.formId)),

  updateFormSettings: authenticatedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: getPath("/updateFormSettings"),
        tags: TAGS,
        protect: true,
        summary: "Update the settings of one of your forms",
      },
    })
    .input(updateFormSettingsInputModel)
    .output(formSettingsOutputSchema)
    .mutation(({ input, ctx }) => formService.updateSettings(ctx.user.id, input)),

  setFormPassword: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/setFormPassword"),
        tags: TAGS,
        protect: true,
        summary: "Set or remove the password an audience needs to open a form",
      },
    })
    .input(setFormPasswordInputModel)
    .output(setPasswordOutputSchema)
    .mutation(({ input, ctx }) => formService.setPassword(ctx.user.id, input)),

  updateFormSlug: authenticatedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: getPath("/updateFormSlug"),
        tags: TAGS,
        protect: true,
        summary: "Change the share slug. Existing QR codes will stop working.",
      },
    })
    .input(updateFormSlugInputModel)
    .output(slugOutputSchema)
    .mutation(({ input, ctx }) => formService.updateSlug(ctx.user.id, input)),

  /**
   * One procedure for the whole status lifecycle. Publishing is the gate between the
   * builder and the audience, and is where the form is checked for being fillable.
   */
  setFormStatus: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/setFormStatus"),
        tags: TAGS,
        protect: true,
        summary: "Publish, unpublish or close one of your forms",
      },
    })
    .input(setFormStatusInputModel)
    .output(formSettingsOutputSchema)
    .mutation(({ input, ctx }) => formService.setStatus(ctx.user.id, input)),

  deleteForm: authenticatedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: getPath("/deleteForm"),
        tags: TAGS,
        protect: true,
        summary: "Delete one of your forms, with every response it collected",
      },
    })
    .input(deleteFormInputModel)
    .output(idOutputSchema)
    .mutation(({ input, ctx }) => formService.deleteForm(ctx.user.id, input)),
});
