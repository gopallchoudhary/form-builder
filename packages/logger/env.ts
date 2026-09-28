import { z } from "zod";

/** Treat an empty string as "not provided" so blank lines in .env are optional. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOGGER_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(["error", "info", "debug", "warn"]).optional(),
  ),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
