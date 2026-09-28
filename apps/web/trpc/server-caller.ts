import { headers } from "next/headers";

import { createTRPCProxyClient, httpBatchLink, type ServerRouter } from "@repo/trpc/client";
import { env } from "~/env.js";

/**
 * A tRPC client for server components and route handlers.
 *
 * The browser client in `create-client.ts` authenticates with `credentials: "include"`,
 * which a browser honours and Node's `fetch` silently ignores — Node only sends a cookie
 * that is present in the `cookie` request header. A server component asking "who is this?"
 * therefore got 401 for every signed-in visitor, and every protected page treated that as
 * "signed out". Forwarding the header is the fix.
 *
 * Must be called per request: `headers()` is dynamic in Next, and a client built once would
 * hold one visitor's cookie for the next.
 */
export async function createServerCaller() {
  const cookie = (await headers()).get("cookie");

  return createTRPCProxyClient<ServerRouter>({
    links: [
      httpBatchLink({
        url: env.API_URL ?? env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc",
        headers: cookie ? { cookie } : {},
      }),
    ],
  });
}
