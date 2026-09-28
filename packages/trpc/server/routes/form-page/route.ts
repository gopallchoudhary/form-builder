import { formPageService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  createPageInputModel,
  createPageOutputSchema,
  deletePageInputModel,
  idOutputSchema,
  listPagesInputModel,
  listPagesOutputSchema,
  reorderPagesInputModel,
  reorderPagesOutputSchema,
  updatePageInputModel,
} from "./model";

import { authenticatedProcedure, router } from "../../trpc";

const TAGS = ["Form page"];
const getPath = generatePath("/form/page");

export const formPageRouter = router({
  listPages: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listPages"),
        tags: TAGS,
        protect: true,
        summary: "List the pages of one of your forms, in order",
      },
    })
    .input(listPagesInputModel)
    .output(listPagesOutputSchema)
    .query(({ input, ctx }) => formPageService.listPages(ctx.user.id, input)),

  createPage: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createPage"),
        tags: TAGS,
        protect: true,
        summary: "Add a page to one of your forms",
      },
    })
    .input(createPageInputModel)
    .output(createPageOutputSchema)
    .mutation(({ input, ctx }) => formPageService.createPage(ctx.user.id, input)),

  updatePage: authenticatedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: getPath("/updatePage"),
        tags: TAGS,
        protect: true,
        summary: "Rename a page of one of your forms",
      },
    })
    .input(updatePageInputModel)
    .output(idOutputSchema)
    .mutation(({ input, ctx }) => formPageService.updatePage(ctx.user.id, input)),

  deletePage: authenticatedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: getPath("/deletePage"),
        tags: TAGS,
        protect: true,
        summary: "Delete a page. Its questions stay, with no page.",
      },
    })
    .input(deletePageInputModel)
    .output(idOutputSchema)
    .mutation(({ input, ctx }) => formPageService.deletePage(ctx.user.id, input)),

  reorderPages: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/reorderPages"),
        tags: TAGS,
        protect: true,
        summary: "Set the page order of one of your forms",
      },
    })
    .input(reorderPagesInputModel)
    .output(reorderPagesOutputSchema)
    .mutation(({ input, ctx }) => formPageService.reorderPages(ctx.user.id, input)),
});
