import http from "node:http";
import { logger } from "@repo/logger";
import { app as expressApplication } from "./server";

import { env } from "./env";

const server = http.createServer(expressApplication);

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
