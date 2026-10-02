import { isTRPCClientError } from "@repo/trpc/client";

/**
 * Retrying a request that failed.
 *
 * Small and deliberately blunt. Its reason for existing is a respondent staring at a form
 * that will not finish booting: a transient failure there has no way to recover on its own,
 * because the component that would retry has already given up and the only escape is a manual
 * refresh.
 */

export type Sleep = (ms: number) => Promise<void>;

/** Enough for a slow start or a dropped connection, short enough not to feel like a hang. */
export const RETRY_DELAYS_MS: readonly number[] = [500, 1500, 4000];

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether another attempt could plausibly succeed.
 *
 * 4xx is the server's considered answer — a wrong password, a missing unlock, a malformed
 * request — and asking again changes nothing but the wait. 5xx and network-level failures are
 * the opposite: the request was fine and the answer was not, so it is worth asking again.
 *
 * 429 is a 4xx and so is not retried, which is also where tRPC's own `retryableRpcCodes`
 * lands: that list is 502/503/504/500 and pointedly excludes it. The rate limiter decides when
 * a request is welcome; repeating underneath it only competes with itself.
 *
 * Anything without a status is treated as retryable. A dropped connection never reaches the
 * server, so it is the most transient failure there is, and the overwhelming majority of
 * failures in practice are this or a 5xx.
 */
export function isRetryableError(error: unknown): boolean {
  if (!isTRPCClientError(error)) return true;

  const status = error.data?.httpStatus;
  if (typeof status !== "number") return true;

  return status < 400 || status >= 500;
}

export interface RetryOptions {
  /** Pause before each retry. Its length is also the number of retries. */
  delays?: readonly number[];
  /** Injectable so tests do not actually wait. */
  sleep?: Sleep;
  /** Decides whether a given failure is worth another attempt. */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Run `task`, retrying transient failures with the given pauses between attempts.
 *
 * Rejects with the *last* error once the delays are exhausted, so the caller reports the
 * failure it actually ended on rather than the first one seen. A delay is never slept after
 * the final attempt — that would add a pointless pause to every terminal failure.
 *
 * Not a queue and not a circuit breaker. One caller, one request, a handful of attempts.
 */
export async function runWithRetries<T>(
  task: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    delays = RETRY_DELAYS_MS,
    sleep = defaultSleep,
    shouldRetry = isRetryableError,
  } = options;

  let attempt = 0;
  for (;;) {
    try {
      return await task(attempt);
    } catch (error) {
      const delay = delays[attempt];
      if (delay === undefined || !shouldRetry(error)) throw error;

      attempt += 1;
      await sleep(delay);
    }
  }
}