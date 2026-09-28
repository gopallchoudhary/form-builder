import { trpc } from "~/trpc/client";

//, sign up hook 
export const useSignUp = () => {
  const utils = trpc.useUtils()
  const {
    mutateAsync: createUserWithEmailAndPasswordAsync,
    mutate: createUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status
  } = trpc.auth.createUserWithEmailAndPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.getLoggedInUserInfo.invalidate()
    }
  });

  return {
    createUserWithEmailAndPasswordAsync,
    createUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status
  };
};


//, sign in hook 
export const useSignIn = () => {
  const {
    mutateAsync: signinUserWithEmailAndPasswordAsync,
    mutate: signinUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
  } = trpc.auth.signinUserWithEmailAndPassword.useMutation();

  return {
    signinUserWithEmailAndPasswordAsync,
    signinUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
  };
};

export type UserStatus = "loading" | "authenticated" | "anonymous";

//, get user info hook 

/**
 * The signed-in user, with the three states a caller actually has to handle.
 *
 * `isFetched` alone was not enough: it is false both before the query runs and when it
 * fails, so "loading" and "signed out" looked identical and every protected page sent
 * the visitor to `/login` on first paint. `status` makes the difference explicit.
 */
export const useUser = () => {
  const { data: user, isFetched, isLoading, isError, refetch } =
    trpc.auth.getLoggedInUserInfo.useQuery(undefined, { retry: false });

  const status: UserStatus = isLoading || (!isFetched && !isError)
    ? "loading"
    : user
      ? "authenticated"
      : "anonymous";

  return { user, status, isLoading, isError, refetch };
}