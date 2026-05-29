import { trpc } from "~/trpc/client";

export const useSignup = () => {
  const {
    mutateAsync: createUserWithEmailAndPasswordAsync,
    mutate: createUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
    status
  } = trpc.auth.createUserWithEmailAndPassword.useMutation();

  return {
    createUserWithEmailAndPasswordAsync,
    createUserWithEmailAndPassword,
    isError,
    error,
    isIdle,
    failureCount,
    isSuccess,
  };
};


export const useSignin = () => {
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