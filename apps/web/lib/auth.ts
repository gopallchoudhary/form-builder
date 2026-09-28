import { TRPCClientError } from "@repo/trpc/client";
import { redirect } from "next/navigation";

import { createServerCaller } from "~/trpc/server-caller";

export interface SessionUser {
  id: string;
  fullName: string | null;
  email: string;
}

export function isUnauthorised(error: unknown): boolean {
  return error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";
}

/**
 * The signed-in user, or `null` when there is no session.
 *
 * Only `UNAUTHORIZED` becomes `null`. Any other failure is rethrown: a 500 from the API
 * must not be reported to the visitor as "please sign in", or a broken API would look
 * like a working sign-out and quietly send real users to the login page.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const api = await createServerCaller();
    return await api.auth.getLoggedInUserInfo.query();
  } catch (error) {
    if (isUnauthorised(error)) return null;
    throw error;
  }
}

/**
 * The signed-in user, or a redirect to `/login`.
 *
 * Called from a server component so the visitor never paints a protected page first and
 * then gets bounced — the "client flash" the dashboard had.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
