"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useSignIn } from "~/hooks/api/auth";
import { cn } from "~/lib/utils";

type SignInFormValue = {
  email: string;
  password: string;
};

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const { signinUserWithEmailAndPasswordAsync, isError, error, isPending } = useSignIn();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValue>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit: SubmitHandler<SignInFormValue> = async (data) => {
    // No logging of the form values: the password is in there, and a console log is a
    // permanent record in every screenshot and bug report taken afterwards.
    await signinUserWithEmailAndPasswordAsync({
      email: data.email,
      password: data.password,
    });

    router.replace("/dashboard");
    // The session cookie was just set, so the server-rendered shell has to be re-fetched
    // or the dashboard layout still renders as though nobody is signed in.
    router.refresh();
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter the email and password you signed up with.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  {...register("email", { required: "Enter your email" })}
                />
                {errors.email && (
                  <p className="text-destructive text-xs">{errors.email.message}</p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  {...register("password", { required: "Enter your password" })}
                />
                {errors.password && (
                  <p className="text-destructive text-xs">{errors.password.message}</p>
                )}
              </Field>

              {isError && (
                <p role="alert" className="text-destructive text-sm">
                  {(error as unknown as Error)?.message ??
                    "That email and password do not match."}
                </p>
              )}

              <Field>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Signing in…" : "Sign in"}
                </Button>
                <FieldDescription className="text-center">
                  No account yet?{" "}
                  <Link href="/signup" className="underline underline-offset-4">
                    Create one
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
