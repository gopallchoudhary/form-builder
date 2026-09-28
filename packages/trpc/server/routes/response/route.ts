import { z } from "zod";

import { responseService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  deleteResponseInputModel,
  deleteResponseOutputSchema,
  listResponsesInputModel,
  listResponsesOutputSchema,
} from "./model";

import { authenticatedProcedure, router } from "../../trpc";

const TAGS = ["Response"];
const getPath = generatePath("/form/response");

export const responseRouter = router({
  listResponses: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listResponses"),
        tags: TAGS,
        protect: true,
        summary: "List the responses collected by one of your forms",
      },
    })
    .input(listResponsesInputModel)
    .output(listResponsesOutputSchema)
    .query(({ input, ctx }) => responseService.listResponses(ctx.user.id, input)),

  exportCsv: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/exportCsv"),
        tags: TAGS,
        protect: true,
        summary: "Export the responses of one of your forms as CSV",
      },
    })
    .input(listResponsesInputModel)
    .output(z.object({ csv: z.string() }))
    .query(async ({ input, ctx }) => ({ csv: await responseService.exportCsv(ctx.user.id, input) })),

  deleteResponse: authenticatedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: getPath("/deleteResponse"),
        tags: TAGS,
        protect: true,
        summary: "Delete a single response",
      },
    })
    .input(deleteResponseInputModel)
    .output(deleteResponseOutputSchema)
    .mutation(({ input, ctx }) => responseService.deleteResponse(ctx.user.id, input)),
});
