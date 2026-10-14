import http from "node:http";
import { logger } from "@repo/logger";
import { attachRealtimeServer, registerRealtimeHandlers } from "@repo/trpc/server";
import { Server as SocketIOServer } from "socket.io";
import { app as expressApplication } from "./server";

import { env } from "./env";

const server = http.createServer(expressApplication);

/**
 * Realtime bus, broadcast-only by design.
 *
 * Votes travel over tRPC mutations; this socket only tells poll watchers that fresh tallies
 * exist. A socket that could write would need a second copy of every guard the mutation
 * already has, so there is deliberately no vote handler here — subscribe/join logic arrives
 * with the poll feature, and until then this only proves the transport is up.
 *
 * CORS mirrors the Express config below (`server.ts`): same allowlist, same credentials,
 * same tolerance for origin-less (non-browser) clients. Socket.IO does not read Express
 * middleware, so sharing the list alone is not sharing the policy.
 */
const io = new SocketIOServer(server, {
  cors: {
    credentials: true,
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);

      logger.warn("Blocked cross-origin socket connection", { origin });
      return callback(new Error("Origin not allowed"), false);
    },
  },
});

attachRealtimeServer(io);
registerRealtimeHandlers(io);

io.on("connection", (socket) => {
  logger.debug("Socket connected", { socketId: socket.id });

  socket.on("disconnect", (reason) => {
    logger.debug("Socket disconnected", { socketId: socket.id, reason });
  });
});

/**
 * `listen` reports failures asynchronously, so the try/catch around it can never
 * catch them — without this handler a port clash takes the process down with an
 * unhandled 'error' event instead of a readable message.
 */
server.on("error", (err) => {
  const isAddressInUse =
    err instanceof Error && "code" in err && (err as { code?: string }).code === "EADDRINUSE";

  logger.error(isAddressInUse ? `Port ${env.PORT} is already in use` : "HTTP server error", {
    err,
  });
  process.exit(1);
});

server.on("listening", () => {
  logger.info(`http server is running on PORT ${env.PORT}`);
});

server.listen(env.PORT);
