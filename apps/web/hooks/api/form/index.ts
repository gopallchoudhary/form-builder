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
      await utils.form.invalidate()
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
