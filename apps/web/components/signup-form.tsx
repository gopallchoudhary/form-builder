"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useSignUp } from "~/hooks/api/auth";
import { cn } from "~/lib/utils";

type SignUpFormValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const { createUserWithEmailAndPasswordAsync, isPending, error } = useSignUp();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit: SubmitHandler<SignUpFormValues> = async (data) => {
    // The password is never logged, and never leaves this function except in the request
    // body. An earlier version logged the whole form object, which put the plaintext
    // password into every browser console, screenshot and bug report thereafter.
    await createUserWithEmailAndPasswordAsync({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
    });

    // Creating an account is the one moment a new person expects to land somewhere useful.
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>You will be signed in once it is created.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full name</FieldLabel>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  {...register("fullName", { required: "Enter your name" })}
                />
                {errors.fullName && (
                  <p className="text-destructive text-xs">{errors.fullName.message}</p>
                )}
              </Field>

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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      {...register("password", {
                        required: "Choose a password",
                        minLength: {
                          value: 8,
                          message: "Use at least 8 characters",
                        },
                      })}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      {...register("confirmPassword", {
                        required: "Type the password again",
                        validate: (value, form) =>
                          value === form.password || "The two passwords do not match",
                      })}
                    />
                    {errors.confirmPassword && (
                      <p className="text-destructive text-xs">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </Field>
                </div>
                {/* Only ever a rule, never a value — a hint that printed the password back
                    would undo the point of the field type. */}
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>

              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {(error as unknown as Error)?.message ??
                    "That account could not be created."}
                </p>
              )}

              <Field>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating your account…" : "Create account"}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link href="/login" className="underline underline-offset-4">
                    Sign in
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
