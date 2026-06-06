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

//, create field hook
export const useCreateField = (formId: string) => {
  const utils = trpc.useUtils()
  const {
    mutateAsync: createFieldAsync,
    mutate: createField,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  } = trpc.form.createField.useMutation({
    onSuccess: async () => {
      await utils.form.getField.invalidate()
    }
  })

  return {
    createFieldAsync,
    createField,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  }
}

//, update field hook
export const useUpdateField = () => {
  const utils = trpc.useUtils()
  const {
    mutateAsync: updateFieldAsync,
    mutate: updateField,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  } = trpc.form.updateField.useMutation({
    onSuccess: async (data) => {
      await utils.form.getField.invalidate({ fieldId: data.id })
    }
  })

  return {
    updateFieldAsync,
    updateField,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  }
}

//, delete field hook
export const useDeleteField = () => {
  const utils = trpc.useUtils()
  const {
    mutateAsync: deleteFieldAsync,
    mutate: deleteField,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  } = trpc.form.deleteField.useMutation({
    onSuccess: async () => {
      await utils.form.getField.invalidate()
    }
  })

  return {
    deleteFieldAsync,
    deleteField,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status,
  }
}

//, get field hook
export const useGetField = (fieldId: string) => {
  const {
    data: field,
    isLoading,
    isFetching,
    isFetched,
    isError,
    error,
    refetch,
  } = trpc.form.getField.useQuery(
    { fieldId },
    { enabled: !!fieldId }
  )

  return {
    field,
    isLoading,
    isFetching,
    isFetched,
    isError,
    error,
    refetch,
  }
}
