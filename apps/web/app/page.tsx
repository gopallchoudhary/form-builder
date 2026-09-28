import { redirect } from "next/navigation";

import { getCurrentUser } from "~/lib/auth";

/**
 * A server component, so the redirect happens before anything is sent to the browser.
 *
 * This page used to be a client component doing `router.replace("/dashboard")` from an
 * effect keyed on the user query. During the query's first render `user` is undefined,
 * so the effect chose `/login` before the answer arrived — and once it had replaced to
 * `/login`, the dashboard's own copy of the same effect replaced back. Hence the loop.
 */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
