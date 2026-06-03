import { is } from "zod/v4/locales/index.js";
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

//, get user info hook 

export const useUser = () => {
  const {data: user, isFetched,  } = trpc.auth.getLoggedInUserInfo.useQuery()

  return {user, isFetched}
}