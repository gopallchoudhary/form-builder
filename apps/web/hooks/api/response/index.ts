import { trpc } from "~/trpc/client";

/**
 * Response hooks.
 *
 * The list and the analytics both change when a response is deleted, so the mutation
 * invalidates both rather than leaving a stale total on the analytics page.
 */

export type ListResponsesFilters = {
  page?: number;
  pageSize?: number;
  status?: "COMPLETED" | "IN_PROGRESS" | "ALL";
  search?: string;
  from?: string;
  to?: string;
};

export const useListResponses = (formId: string | null, filters: ListResponsesFilters = {}) => {
  const { data, isLoading, isFetching, isError, error, refetch } =
    trpc.response.listResponses.useQuery(
      { formId: formId ?? "", ...filters },
      { enabled: !!formId, placeholderData: (previous) => previous },
    );

  return {
    responses: data?.responses,
    total: data?.total,
    page: data?.page,
    pageSize: data?.pageSize,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
};

export const useExportCsv = (formId: string | null) =>
  trpc.response.exportCsv.useQuery({ formId: formId ?? "" }, { enabled: !!formId });

export const useDeleteResponse = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: deleteResponseAsync, status, isError, error } =
    trpc.response.deleteResponse.useMutation({
      onSuccess: async (_data, variables) => {
        await utils.response.listResponses.invalidate({ formId: variables.formId });
        await utils.analytics.getFormAnalytics.invalidate({ formId: variables.formId });
        await utils.analytics.getFunnel.invalidate({ formId: variables.formId });
      },
    });

  return { deleteResponseAsync, status, isError, error };
};
