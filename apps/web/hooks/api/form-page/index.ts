import { trpc } from "~/trpc/client";

// ── Pages ──────────────────────────────────────────────────────────────────────

/**
 * A page mutation does not always return — or even accept — the `formId` it touched, so
 * the invalidation target has to be chosen per procedure.
 *
 * `createPage` and `reorderPages` take a `formId`, so they can name the exact cache entry.
 * `updatePage` and `deletePage` identify the page alone, so they invalidate every entry
 * instead — a stale list is a small cost next to invalidating a key that matches nothing,
 * which is what the old `form` hooks did.
 */

export const useListPages = (formId: string | null) =>
  trpc.formPage.listPages.useQuery({ formId: formId ?? "" }, { enabled: !!formId });

export const useCreatePage = () => {
  const utils = trpc.useUtils();

  return trpc.formPage.createPage.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.formPage.listPages.invalidate({ formId: variables.formId });
      await utils.form.getForm.invalidate({ formId: variables.formId });
    },
  });
};

export const useUpdatePage = () => {
  const utils = trpc.useUtils();

  return trpc.formPage.updatePage.useMutation({
    onSuccess: async () => {
      await utils.formPage.listPages.invalidate();
      await utils.form.getForm.invalidate();
    },
  });
};

export const useDeletePage = () => {
  const utils = trpc.useUtils();

  return trpc.formPage.deletePage.useMutation({
    onSuccess: async () => {
      await utils.formPage.listPages.invalidate();
      await utils.form.getForm.invalidate();
    },
  });
};

export const useReorderPages = () => {
  const utils = trpc.useUtils();

  return trpc.formPage.reorderPages.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.formPage.listPages.invalidate({ formId: variables.formId });
      await utils.form.getForm.invalidate({ formId: variables.formId });
    },
  });
};
