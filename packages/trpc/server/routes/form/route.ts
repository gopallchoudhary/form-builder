import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formService, formFieldService } from "../../services";
import {
    createFormInputModel,
    createFormOutputModel,
    listFormsInputModel,
    listFormsOutputModel,
    createFieldInputModel,
    createFieldOutputModel,
    updateFieldInputModel,
    updateFieldOutputModel,
    deleteFieldInputModel,
    deleteFieldOutputModel,
    getFieldInputModel,
    getFieldOutputModel,
} from "./model";

const TAGS = ["Form"];
const getPath = generatePath("/form");

export const formRouter = router({

    //. create form
    createForm: authenticatedProcedure
        .meta({ openapi: {
            method: 'POST',
            path: getPath('/createForm'),
            tags: TAGS,
            protect: true,
        }})
        .input(createFormInputModel)
        .output(createFormOutputModel)
        .mutation(async ({ input, ctx }) => {
            const { title, description } = input

            const { id } = await formService.createForm(ctx.user.id, {
                title,
                description,
            })

            return { id }
        }),

    //. list forms
    listForms: authenticatedProcedure
        .meta({ openapi: {
            method: 'GET',
            path: getPath('/listForms'),
            tags: TAGS,
            protect: true,
        }})
        .input(listFormsInputModel)
        .output(listFormsOutputModel)
        .query(async ({ ctx }) => {
            const forms = await formService.listFormsByUserId({ userId: ctx.user.id })
            return forms
        }),

    //. create field
    createField: authenticatedProcedure
        .meta({ openapi: {
            method: 'POST',
            path: getPath('/createField'),
            tags: TAGS,
            protect: true,
        }})
        .input(createFieldInputModel)
        .output(createFieldOutputModel)
        .mutation(async ({ input }) => {
            const { id, labelKey } = await formFieldService.createField(input)
            return { id, labelKey }
        }),

    //. update field
    updateField: authenticatedProcedure
        .meta({ openapi: {
            method: 'PATCH',
            path: getPath('/updateField'),
            tags: TAGS,
            protect: true,
        }})
        .input(updateFieldInputModel)
        .output(updateFieldOutputModel)
        .mutation(async ({ input }) => {
            const { id } = await formFieldService.updateField(input)
            return { id }
        }),

    //. delete field
    deleteField: authenticatedProcedure
        .meta({ openapi: {
            method: 'DELETE',
            path: getPath('/deleteField'),
            tags: TAGS,
            protect: true,
        }})
        .input(deleteFieldInputModel)
        .output(deleteFieldOutputModel)
        .mutation(async ({ input }) => {
            const { id } = await formFieldService.deleteField(input)
            return { id }
        }),

    //. get field
    getField: authenticatedProcedure
        .meta({ openapi: {
            method: 'GET',
            path: getPath('/getField'),
            tags: TAGS,
            protect: true,
        }})
        .input(getFieldInputModel)
        .output(getFieldOutputModel)
        .query(async ({ input }) => {
            const field = await formFieldService.getField(input)
            return field
        }),
})