import { describe, expect, it, vi } from "vitest";
import { isTRPCClientError, TRPCClientError } from "@repo/trpc/client";

import { isRetryableError, RETRY_DELAYS_MS, runWithRetries } from "~/lib/retry";

/**
 * Retrying the session start.
 *
 * The failure this exists for is a respondent left looking at a form that will not finish
 * booting, with a manual refresh as the only escape. The rules that matter are which failures
 * are worth repeating — a considered 4xx must not be repeated, because that only adds waiting
 * in front of an answer that will not change — and that the last failure is the one reported.
 */

/** Records the pauses instead of taking them, so a retry test costs nothing. */
const recordingSleep = () => {
  const waited: number[] = [];
  return {
    waited,
    sleep: async (ms: number) => {
      waited.push(ms);
    },
  };
};

describe("runWithRetries", () => {
  it("does not retry a task that succeeds", async () => {
    const { waited, sleep } = recordingSleep();
    const task = vi.fn(async () => "ok");

    await expect(runWithRetries(task, { sleep })).resolves.toBe("ok");

    expect(task).toHaveBeenCalledTimes(1);
    expect(waited).toHaveLength(0);
  });

  it("retries a transient failure and returns the eventual result", async () => {
    const { waited, sleep } = recordingSleep();
    let attempts = 0;

    const result = await runWithRetries(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("network");
        return "recovered";
      },
      { sleep },
    );

    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
    // One pause before each retry, and not one after the success.
    expect(waited).toEqual([RETRY_DELAYS_MS[0], RETRY_DELAYS_MS[1]]);
  });

  it("gives up after the delays are exhausted and rethrows the last error", async () => {
    const { waited, sleep } = recordingSleep();
    const errors = ["first", "second", "third", "fourth"].map((message) => new Error(message));
    let attempts = 0;

    // The failure a respondent would see has to be the one that actually ended it, not the
    // first thing that went wrong half a minute ago.
    await expect(
      runWithRetries(
        async () => {
          throw errors[attempts++]!;
        },
        { delays: [10, 20, 30], sleep, shouldRetry: () => true },
      ),
    ).rejects.toBe(errors[errors.length - 1]);

    // Three delays means four attempts, and one pause between each of them.
    expect(attempts).toBe(errors.length);
    expect(waited).toEqual([10, 20, 30]);
  });

  it("never sleeps after the final attempt", async () => {
    const { waited, sleep } = recordingSleep();

    await expect(
      runWithRetries(
        async () => {
          throw new Error("always");
        },
        { delays: [1, 2], sleep, shouldRetry: () => true },
      ),
    ).rejects.toThrow();

    // Two delays means three attempts. A third pause would be pure waiting in front of a
    // failure nobody is going to read differently.
    expect(waited).toEqual([1, 2]);
  });

  it("stops immediately on a failure it is told not to retry", async () => {
    const { waited, sleep } = recordingSleep();
    let attempts = 0;

    await expect(
      runWithRetries(
        async () => {
          attempts += 1;
          throw new Error("forbidden");
        },
        { sleep, shouldRetry: () => false },
      ),
    ).rejects.toThrow("forbidden");

    expect(attempts).toBe(1);
    expect(waited).toHaveLength(0);
  });

  it("tells the task which attempt it is", async () => {
    const { sleep } = recordingSleep();
    const seen: number[] = [];

    await runWithRetries(
      async (attempt) => {
        seen.push(attempt);
        if (attempt < 2) throw new Error("again");
        return "done";
      },
      { sleep },
    );

    expect(seen).toEqual([0, 1, 2]);
  });
});

describe("isRetryableError", () => {
  /*
   * Built the way the client builds one — from a JSON-RPC error response — because the
   * constructor does not take `httpStatus` directly. An error assembled from the wrong shape
   * has no `data` at all, and then everything reads as "unclassified" and therefore retryable,
   * which would make these tests pass for the wrong reason.
   */
  const clientError = (httpStatus: number) =>
    TRPCClientError.from({
      error: {
        code: -32603,
        message: "it failed",
        data: {
          code: httpStatus >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
          httpStatus,
          path: "public.startSession",
        },
      },
    });

  it("can actually read a status off the error", () => {
    // Guards the guard: without this, every case below would pass vacuously.
    const error = clientError(403);
    expect(isTRPCClientError(error)).toBe(true);
    expect(error.data?.httpStatus).toBe(403);
  });

  it.each([400, 401, 403, 404, 429])("does not retry a %i", (status) => {
    expect(isRetryableError(clientError(status))).toBe(false);
  });

  it.each([500, 502, 503])("retries a %i", (status) => {
    expect(isRetryableError(clientError(status))).toBe(true);
  });

  it("retries a failure that never reached the server", () => {
    // The most transient failure there is: a dropped connection has no status at all.
    expect(isRetryableError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableError(new Error("boom"))).toBe(true);
  });

  it("retries something it cannot classify", () => {
    // Erring towards retrying costs a few seconds; erring the other way turns a transient
    // blip into a form that refuses to open.
    expect(isRetryableError(undefined)).toBe(true);
    expect(isRetryableError(null)).toBe(true);
  });
});