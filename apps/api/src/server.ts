import { randomUUID } from "node:crypto";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { logger } from "@repo/logger";
import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { appErrorToHttpStatus, createContextFactory, serverRouter } from "@repo/trpc/server";

import { env } from "./env";

export const app = express();

// Correct client IPs (and therefore rate limiting) behind a reverse proxy.
app.set("trust proxy", env.TRUST_PROXY);

// ── Request identity ───────────────────────────────────────────────────────────
// First, so every downstream log line and error carries the id.
const requestId: RequestHandler = (req, res, next) => {
  const id = req.get("x-request-id") || randomUUID();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};
app.use(requestId);

// ── Security headers ───────────────────────────────────────────────────────────
// CSP is disabled because `/docs` is an HTML page that loads the Scalar bundle;
// the rest of this server only ever returns JSON.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Same-origin and non-browser clients send no Origin header.
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);

      logger.warn("Blocked cross-origin request", { origin });
      return callback(null, false);
    },
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// ── Access logging ─────────────────────────────────────────────────────────────
const accessLog: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    const meta = { requestId: res.locals.requestId, durationMs };

    if (res.statusCode >= 500) logger.error(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    else if (res.statusCode >= 400) logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    else logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
  });

  next();
};
app.use(accessLog);

// ── Rate limiting ──────────────────────────────────────────────────────────────
const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

app.use("/api", apiRateLimiter);
app.use("/trpc", apiRateLimiter);

const createContext = createContextFactory({
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  domain: env.COOKIE_DOMAIN,
});

const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "Streamyst OpenAPI",
  version: "1.0.0",
  baseUrl: `${env.API_BASE_URL.replace(/\/+$/, "")}/api`,
  // Sessions are httpOnly cookies, not bearer tokens. Describing them as such keeps
  // the generated docs honest about how a client actually authenticates.
  securitySchemes: {
    sessionCookie: {
      type: "apiKey",
      in: "cookie",
      name: "authentication-token",
    },
  },
});

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  return res.json({ message: "Streamyst is up and running..." });
});

app.get("/health", (_req, res) => {
  return res.json({ message: "Streamyst server is healthy", healthy: true });
});

app.get("/openapi.json", (_req, res) => {
  return res.json(openApiDocument);
});

app.use("/docs", apiReference({ url: "/openapi.json" }));

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
    onError: ({ error, path, type }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        logger.error(`Unhandled ${type} error on ${path ?? "<no path>"}`, { cause: error.cause ?? error });
      }
    },
  }),
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
    onError: ({ error, path, type }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        logger.error(`Unhandled ${type} error on ${path ?? "<no path>"}`, { cause: error.cause ?? error });
      }
    },
  }),
);

// ── Error handler ──────────────────────────────────────────────────────────────
// Must be registered last. Unexpected errors are logged in full and reported
// generically so internals never reach a caller.
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const requestId = res.locals.requestId;
  const status = appErrorToHttpStatus(error) ?? 500;

  if (status >= 500) logger.error("Unhandled request error", { requestId, err: error });
  else logger.warn("Request rejected", { requestId, message: error.message });

  res.status(status).json({
    message: status >= 500 ? "Something went wrong. Please try again." : error.message,
    requestId,
  });
};

app.use(errorHandler);

export default app;
