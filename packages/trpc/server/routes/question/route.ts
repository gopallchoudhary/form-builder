import { questionService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  createQuestionInputModel,
  createQuestionOutputSchema,
  deleteQuestionInputModel,
  duplicateQuestionInputModel,
  duplicateQuestionOutputSchema,
  getQuestionInputModel,
  idOutputSchema,
  listQuestionsInputModel,
  listQuestionsOutputSchema,
  questionOutputSchema,
  reorderQuestionsInputModel,
  reorderQuestionsOutputSchema,
  updateQuestionInputModel,
} from "./model";

import { authenticatedProcedure, router } from "../../trpc";

const TAGS = ["Question"];
const getPath = generatePath("/form/question");

export const questionRouter = router({
  listQuestions: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listQuestions"),
        tags: TAGS,
        protect: true,
        summary: "List the questions of one of your forms, in order",
      },
    })
    .input(listQuestionsInputModel)
    .output(listQuestionsOutputSchema)
    .query(({ input, ctx }) => questionService.listQuestions(ctx.user.id, input)),

  getQuestion: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getQuestion"),
        tags: TAGS,
        protect: true,
        summary: "Get one of your questions",
      },
    })
    .input(getQuestionInputModel)
    .output(questionOutputSchema)
    .query(({ input, ctx }) => questionService.getQuestion(ctx.user.id, input)),

  createQuestion: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createQuestion"),
        tags: TAGS,
        protect: true,
        summary: "Add a question to one of your forms",
      },
    })
    .input(createQuestionInputModel)
    .output(createQuestionOutputSchema)
    .mutation(({ input, ctx }) => questionService.createQuestion(ctx.user.id, input)),

  updateQuestion: authenticatedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: getPath("/updateQuestion"),
        tags: TAGS,
        protect: true,
        summary: "Update one of your questions. The labelKey never changes.",
      },
    })
    .input(updateQuestionInputModel)
    .output(idOutputSchema)
    .mutation(({ input, ctx }) => questionService.updateQuestion(ctx.user.id, input)),

  deleteQuestion: authenticatedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: getPath("/deleteQuestion"),
        tags: TAGS,
        protect: true,
        summary: "Remove a question. Existing responses keep it.",
      },
    })
    .input(deleteQuestionInputModel)
    .output(idOutputSchema)
    .mutation(({ input, ctx }) => questionService.deleteQuestion(ctx.user.id, input)),

  duplicateQuestion: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/duplicateQuestion"),
        tags: TAGS,
        protect: true,
        summary: "Copy one of your questions",
      },
    })
    .input(duplicateQuestionInputModel)
    .output(duplicateQuestionOutputSchema)
    .mutation(({ input, ctx }) => questionService.duplicateQuestion(ctx.user.id, input)),

  reorderQuestions: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/reorderQuestions"),
        tags: TAGS,
        protect: true,
        summary: "Set the question order within a page, or within a stepper form",
      },
    })
    .input(reorderQuestionsInputModel)
    .output(reorderQuestionsOutputSchema)
    .mutation(({ input, ctx }) => questionService.reorderQuestions(ctx.user.id, input)),
});
