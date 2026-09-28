import { createTRPCProxyClient, httpBatchLink, httpBatchStreamLink, type ServerRouter } from "@repo/trpc/client";

import { createTRPCHttpBatchClientClient } from "./create-client";

/**
 * A plain tRPC client — no React, no cache.
 *
 * For code that owns its own state and must not go through React Query: the builder's
 * autosave writes straight from the store, and a refetch behind its back would overwrite
 * edits that have not been sent yet. `trpc` in `client.ts` is the cached, hook-based
 * client for everything else.
 *
 * Despite the old file name this runs in the browser as happily as on the server.
 */
export const api = createTRPCProxyClient<ServerRouter>({
  links: [createTRPCHttpBatchClientClient()],
});

/** The same, with streaming. Kept for parity with the previous export. */
export const apiStreaming = createTRPCProxyClient<ServerRouter>({
  links: [createTRPCHttpBatchClientClient({ enableStreaming: true })],
});

export { httpBatchLink, httpBatchStreamLink };
