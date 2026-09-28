import { authenticatedProcedure, router } from "../../trpc";
import { formService, formFieldService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  createFieldInputModel,
  createFieldOutputModel,
  createFormInputModel,
  createFormOutputModel,
  deleteFieldInputModel,
  deleteFieldOutputModel,
  getFieldInputModel,
  getFieldOutputModel,
  listFieldsInputModel,
  listFieldsOutputModel,
  listFormsInputModel,
  listFormsOutputModel,
  updateFieldInputModel,
  updateFieldOutputModel,
} from "./model";

const TAGS = ["Form"];
const getPath = generatePath("/form");

export const formRouter = router({
  //. create form
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
    .output(createFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id } = await formService.createForm(ctx.user.id, input);
      return { id };
    }),

  //. list forms
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
    .output(listFormsOutputModel)
    .query(async ({ ctx }) => {
      return formService.listFormsByUserId({ userId: ctx.user.id });
    }),

  //. create field
  createField: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createField"),
        tags: TAGS,
        protect: true,
        summary: "Add a field to a form",
      },
    })
    .input(createFieldInputModel)
    .output(createFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id, labelKey } = await formFieldService.createField(ctx.user.id, input);
      return { id, labelKey };
    }),

  //. update field
  updateField: authenticatedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: getPath("/updateField"),
        tags: TAGS,
        protect: true,
        summary: "Update a field of one of your forms",
      },
    })
    .input(updateFieldInputModel)
    .output(updateFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id } = await formFieldService.updateField(ctx.user.id, input);
      return { id };
    }),

  //. delete field
  deleteField: authenticatedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: getPath("/deleteField"),
        tags: TAGS,
        protect: true,
        summary: "Delete a field of one of your forms",
      },
    })
    .input(deleteFieldInputModel)
    .output(deleteFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id } = await formFieldService.deleteField(ctx.user.id, input);
      return { id };
    }),

  //. get field
  getField: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getField"),
        tags: TAGS,
        protect: true,
        summary: "Get one of your fields",
      },
    })
    .input(getFieldInputModel)
    .output(getFieldOutputModel)
    .query(async ({ input, ctx }) => {
      return formFieldService.getField(ctx.user.id, input);
    }),

  //. list fields
  listFields: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listFields"),
        tags: TAGS,
        protect: true,
        summary: "List the fields of one of your forms",
      },
    })
    .input(listFieldsInputModel)
    .output(listFieldsOutputModel)
    .query(async ({ input, ctx }) => {
      return formFieldService.listFields(ctx.user.id, input);
    }),
});
