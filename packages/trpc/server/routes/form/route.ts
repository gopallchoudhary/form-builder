import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formService } from "../../services";
import { createFormInputModel, createFormOutputModel } from "./model";

const TAGS = ["Form"];
const getPath = generatePath("/form");

export const formRouter = router({

    //. create form
    createForm: authenticatedProcedure
        .meta({ openapi: {
            method: 'POST',
            path: getPath('/createForm'),
            tags: TAGS,
            protect: true
        }})
        .input(createFormInputModel)
        .output(createFormOutputModel)
        .mutation(async ({ input, ctx }) => {
            const { title, description } = input

            const { id } = await formService.createForm(ctx.user.id, {
                title,
                description,
            })

            return {
                id,
            }
        }),
})