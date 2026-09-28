import { trpc } from "~/trpc/client";

/**
 * Form and question hooks.
 *
 * Every mutation that changes a question invalidates both the single-question cache
 * and the whole-form list, because the builder mirrors server state in a local
 * store and a stale cache silently undoes the optimistic update.
 */

//, create form
export const useCreateForm = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: createFormAsync, status, isError, error } =
    trpc.form.createForm.useMutation({
      onSuccess: async () => {
        await utils.form.listForms.invalidate();
      },
    });

  return { createFormAsync, status, isError, error };
};

//, list forms
export const useListForms = () => {
  const { data: forms, isLoading, isFetching, isError, error, refetch } =
    trpc.form.listForms.useQuery();

  return { forms, isLoading, isFetching, isError, error, refetch };
};

//, create question
export const useCreateQuestion = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: createQuestionAsync, status, isError, error } =
    trpc.form.createQuestion.useMutation({
      onSuccess: async (data, variables) => {
        await utils.form.getQuestion.invalidate({ questionId: data.id });
        await utils.form.listQuestions.invalidate({ formId: variables.formId });
      },
    });

  return { createQuestionAsync, status, isError, error };
};

//, update question
export const useUpdateQuestion = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: updateQuestionAsync, status, isError, error } =
    trpc.form.updateQuestion.useMutation({
      onSuccess: async (data) => {
        await utils.form.getQuestion.invalidate({ questionId: data.id });
        // No formId is available here, so every form's list is invalidated.
        await utils.form.listQuestions.invalidate();
      },
    });

  return { updateQuestionAsync, status, isError, error };
};

//, delete question
export const useDeleteQuestion = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: deleteQuestionAsync, status, isError, error } =
    trpc.form.deleteQuestion.useMutation({
      onSuccess: async (data, variables) => {
        await utils.form.getQuestion.invalidate({ questionId: data.id });
        await utils.form.getQuestion.invalidate({ questionId: variables.questionId });
        await utils.form.listQuestions.invalidate();
      },
    });

  return { deleteQuestionAsync, status, isError, error };
};

//, get question
export const useGetQuestion = (questionId: string | null) => {
  const { data: question, isLoading, isFetching, isError, error, refetch } =
    trpc.form.getQuestion.useQuery({ questionId: questionId ?? "" }, { enabled: !!questionId });

  return { question, isLoading, isFetching, isError, error, refetch };
};

//, list questions of a form
export const useListQuestions = (formId: string | null) => {
  const { data: questions, isLoading, isFetching, isError, error, refetch } =
    trpc.form.listQuestions.useQuery({ formId: formId ?? "" }, { enabled: !!formId });

  return { questions, isLoading, isFetching, isError, error, refetch };
};
