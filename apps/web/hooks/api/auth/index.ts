import { useRouter } from "next/navigation";

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
    status,
    isPending: status === "pending",
  };
};


//, sign in hook 
export const useSignIn = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: signinUserWithEmailAndPasswordAsync,
    mutate: signinUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    isPending,
  } = trpc.auth.signinUserWithEmailAndPassword.useMutation({
    onSuccess: async () => {
      // The session cookie is new, so a cached user is a cache entry waiting to be wrong.
      await utils.auth.getLoggedInUserInfo.invalidate();
    },
  });

  return {
    signinUserWithEmailAndPasswordAsync,
    signinUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    isPending,
  };
};

export type UserStatus = "loading" | "authenticated" | "anonymous";

/**
 * Sign out.
 *
 * The mutation clears the session cookie, so there is nothing client-side to undo — the
 * cached user is dropped and the user is sent to the login page in one step. Navigating
 * without clearing the cache would paint the signed-in sidebar for a frame on a page the
 * user can no longer load anything on.
 */
export const useSignOut = () => {
  const utils = trpc.useUtils();
  const router = useRouter();

  const { mutateAsync: signOutUser, isPending, isError, error } =
    trpc.auth.signOutUser.useMutation({
      onSuccess: async () => {
        await utils.auth.getLoggedInUserInfo.invalidate();
        router.replace("/login");
        router.refresh();
      },
    });

  return { signOutUser, isPending, isError, error };
};

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