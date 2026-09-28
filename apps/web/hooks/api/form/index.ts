import { trpc } from "~/trpc/client";

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

//, the whole editable form — what the builder hydrates from
export const useGetForm = (formId: string | null) => {
  const { data: form, isLoading, isFetching, isError, error, refetch } =
    trpc.form.getForm.useQuery({ formId: formId ?? "" }, { enabled: !!formId });

  return { form, isLoading, isFetching, isError, error, refetch };
};

//, settings only — what the settings and share pages read
export const useGetFormSettings = (formId: string | null) => {
  const { data: form, isLoading, isFetching, isError, error, refetch } =
    trpc.form.getFormSettings.useQuery({ formId: formId ?? "" }, { enabled: !!formId });

  return { form, isLoading, isFetching, isError, error, refetch };
};

//, set or clear the password an audience needs to open the form
export const useSetFormPassword = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: setFormPasswordAsync, status, isError, error } =
    trpc.form.setFormPassword.useMutation({
      onSuccess: async (_data, variables) => {
        await utils.form.getFormSettings.invalidate({ formId: variables.formId });
        await utils.form.getForm.invalidate({ formId: variables.formId });
      },
    });

  return { setFormPasswordAsync, status, isError, error };
};

//, change the share slug
export const useUpdateFormSlug = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: updateFormSlugAsync, status, isError, error } =
    trpc.form.updateFormSlug.useMutation({
      onSuccess: async (_data, variables) => {
        await utils.form.getFormSettings.invalidate({ formId: variables.formId });
        await utils.form.getForm.invalidate({ formId: variables.formId });
        await utils.form.listForms.invalidate();
      },
    });

  return { updateFormSlugAsync, status, isError, error };
};

//, update form settings
export const useUpdateFormSettings = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: updateFormSettingsAsync, status, isError, error } =
    trpc.form.updateFormSettings.useMutation({
      onSuccess: async (data) => {
        await utils.form.getForm.invalidate({ formId: data.id });
        await utils.form.getFormSettings.invalidate({ formId: data.id });
        await utils.form.listForms.invalidate();
      },
    });

  return { updateFormSettingsAsync, status, isError, error };
};

//, publish / unpublish / close
export const useSetFormStatus = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: setFormStatusAsync, status, isError, error } =
    trpc.form.setFormStatus.useMutation({
      onSuccess: async (data) => {
        await utils.form.getForm.invalidate({ formId: data.id });
        await utils.form.getFormSettings.invalidate({ formId: data.id });
        await utils.form.listForms.invalidate();
      },
    });

  return { setFormStatusAsync, status, isError, error };
};

export const useDeleteForm = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: deleteFormAsync, status, isError, error } =
    trpc.form.deleteForm.useMutation({
      onSuccess: async () => {
        await utils.form.listForms.invalidate();
      },
    });

  return { deleteFormAsync, status, isError, error };
};
