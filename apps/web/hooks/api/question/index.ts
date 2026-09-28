import { trpc } from "~/trpc/client";

/**
 * Question hooks.
 *
 * Every mutation that changes a question invalidates both the single-question cache and
 * the whole-form list, because the builder mirrors server state in a local store and a
 * stale cache silently undoes the optimistic update.
 */

export const useCreateQuestion = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: createQuestionAsync, status, isError, error } =
    trpc.question.createQuestion.useMutation({
      onSuccess: async (_data, variables) => {
        await utils.question.listQuestions.invalidate({ formId: variables.formId });
      },
    });

  return { createQuestionAsync, status, isError, error };
};

export const useUpdateQuestion = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: updateQuestionAsync, status, isError, error } =
    trpc.question.updateQuestion.useMutation({
      onSuccess: async (data) => {
        await utils.question.getQuestion.invalidate({ questionId: data.id });
        // The form the question belongs to is not in the payload, so every form's list
        // is invalidated rather than one that may not be the right one.
        await utils.question.listQuestions.invalidate();
      },
    });

  return { updateQuestionAsync, status, isError, error };
};

export const useDeleteQuestion = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: deleteQuestionAsync, status, isError, error } =
    trpc.question.deleteQuestion.useMutation({
      onSuccess: async (data) => {
        // Invalidate rather than clear: the builder drops the question from its local
        // state, and a stale-but-marked query refetches if something still asks for it.
        await utils.question.getQuestion.invalidate({ questionId: data.id });
        await utils.question.listQuestions.invalidate();
      },
    });

  return { deleteQuestionAsync, status, isError, error };
};

export const useDuplicateQuestion = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: duplicateQuestionAsync, status, isError, error } =
    trpc.question.duplicateQuestion.useMutation({
      onSuccess: async () => {
        await utils.question.listQuestions.invalidate();
      },
    });

  return { duplicateQuestionAsync, status, isError, error };
};

export const useGetQuestion = (questionId: string | null) => {
  const { data: question, isLoading, isFetching, isError, error, refetch } =
    trpc.question.getQuestion.useQuery(
      { questionId: questionId ?? "" },
      { enabled: !!questionId },
    );

  return { question, isLoading, isFetching, isError, error, refetch };
};

export const useListQuestions = (formId: string | null, pageId?: string) => {
  const { data: questions, isLoading, isFetching, isError, error, refetch } =
    trpc.question.listQuestions.useQuery(
      { formId: formId ?? "", ...(pageId ? { pageId } : {}) },
      { enabled: !!formId },
    );

  return { questions, isLoading, isFetching, isError, error, refetch };
};
