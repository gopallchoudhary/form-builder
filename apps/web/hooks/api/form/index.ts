import { trpc } from "~/trpc/client";

//, create form hook
export const useCreateForm = () => {
  const utils = trpc.useUtils()
  const {
    mutateAsync: createFormAsync,
    mutate: createForm,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  } = trpc.form.createForm.useMutation({
    onSuccess: async () => {
      await utils.form.listForms.invalidate()
    }
  });

  return {
    createFormAsync,
    createForm,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  };
};

//, list forms hook
export const useListForms = () => {
  const {
    data: forms,
    isLoading,
    isFetching,
    isFetched,
    isError,
    error,
    refetch,
  } = trpc.form.listForms.useQuery()

  return {
    forms,
    isLoading,
    isFetching,
    isFetched,
    isError,
    error,
    refetch,
  }
}
