import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BASE_URL: z.url().default("http://localhost:8000"),

  /** Browser origins allowed to call this API. */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  /** Number of reverse-proxy hops to trust when deriving the client IP. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

  COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);

if (env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) {
  throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
}

if (env.NODE_ENV === "production" && !env.COOKIE_SECURE) {
  throw new Error("COOKIE_SECURE must be true when NODE_ENV=production");
}
