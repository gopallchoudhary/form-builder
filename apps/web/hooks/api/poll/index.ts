import { trpc } from "~/trpc/client";

//, create poll
export const useCreatePoll = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: createPollAsync, status, isError, error } =
    trpc.poll.createPoll.useMutation({
      onSuccess: async () => {
        await utils.poll.listPolls.invalidate();
      },
    });

  return { createPollAsync, status, isError, error };
};

//, list polls
export const useListPolls = () => {
  const { data: polls, isLoading, isFetching, isError, error, refetch } =
    trpc.poll.listPolls.useQuery();

  return { polls, isLoading, isFetching, isError, error, refetch };
};

//, one poll, for the detail page header
export const useGetPoll = (pollId: string | null) => {
  const { data: poll, isLoading, isFetching, isError, error, refetch } =
    trpc.poll.getPoll.useQuery({ pollId: pollId ?? "" }, { enabled: !!pollId });

  return { poll, isLoading, isFetching, isError, error, refetch };
};

//, the live tally, for the detail page's Results section
export const useGetPollResults = (pollId: string | null) => {
  const { data: results, isLoading, isFetching, isError, error, refetch } =
    trpc.poll.getPollResults.useQuery({ pollId: pollId ?? "" }, { enabled: !!pollId });

  return { results, isLoading, isFetching, isError, error, refetch };
};

//, vote history and peak hours, for the detail page's Insights section
export const useGetPollInsights = (pollId: string | null, days = 30) => {
  const { data: insights, isLoading, isFetching, isError, error, refetch } =
    trpc.poll.getPollInsights.useQuery({ pollId: pollId ?? "", days }, { enabled: !!pollId });

  return { insights, isLoading, isFetching, isError, error, refetch };
};

//, update a poll's title, description or draft options
export const useUpdatePoll = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: updatePollAsync, status, isError, error } =
    trpc.poll.updatePoll.useMutation({
      onSuccess: async (_data, variables) => {
        await utils.poll.listPolls.invalidate();
        await utils.poll.getPoll.invalidate({ pollId: variables.pollId });
      },
    });

  return { updatePollAsync, status, isError, error };
};

//, open, close or reopen a poll
export const useSetPollStatus = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: setPollStatusAsync,
    status,
    isError,
    error,
  } = trpc.poll.setPollStatus.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.poll.listPolls.invalidate();
      await utils.poll.getPoll.invalidate({ pollId: variables.pollId });
    },
  });

  return { setPollStatusAsync, status, isError, error };
};

//, delete a poll
export const useDeletePoll = () => {
  const utils = trpc.useUtils();

  const { mutateAsync: deletePollAsync, status, isError, error } =
    trpc.poll.deletePoll.useMutation({
      onSuccess: async () => {
        await utils.poll.listPolls.invalidate();
      },
    });

  return { deletePollAsync, status, isError, error };
};
