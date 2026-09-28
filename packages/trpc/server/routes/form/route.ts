import { authenticatedProcedure, router } from "../../trpc";
import { formService, questionService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  createFormInputModel,
  createFormOutputModel,
  createQuestionInputModel,
  createQuestionOutputModel,
  deleteQuestionInputModel,
  deleteQuestionOutputModel,
  getQuestionInputModel,
  getQuestionOutputModel,
  listFormsInputModel,
  listFormsOutputModel,
  listQuestionsInputModel,
  listQuestionsOutputModel,
  updateQuestionInputModel,
  updateQuestionOutputModel,
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
      return formService.createForm(ctx.user.id, input);
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

  //. create question
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
    .output(createQuestionOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id, labelKey } = await questionService.createQuestion(ctx.user.id, input);
      return { id, labelKey };
    }),

  //. update question
  updateQuestion: authenticatedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: getPath("/updateQuestion"),
        tags: TAGS,
        protect: true,
        summary: "Update a question of one of your forms",
      },
    })
    .input(updateQuestionInputModel)
    .output(updateQuestionOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id } = await questionService.updateQuestion(ctx.user.id, input);
      return { id };
    }),

  //. delete question
  deleteQuestion: authenticatedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: getPath("/deleteQuestion"),
        tags: TAGS,
        protect: true,
        summary: "Remove a question from one of your forms",
      },
    })
    .input(deleteQuestionInputModel)
    .output(deleteQuestionOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id } = await questionService.deleteQuestion(ctx.user.id, input);
      return { id };
    }),

  //. get question
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
    .output(getQuestionOutputModel)
    .query(async ({ input, ctx }) => {
      return questionService.getQuestion(ctx.user.id, input);
    }),

  //. list questions
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
    .output(listQuestionsOutputModel)
    .query(async ({ input, ctx }) => {
      return questionService.listQuestions(ctx.user.id, input);
    }),
});
