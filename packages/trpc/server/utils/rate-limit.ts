import { TRPCError } from "@trpc/server";

/**
 * Per-procedure rate limiting.
 *
 * Lives in the tRPC layer rather than in Express so a limit travels with the procedure
 * and cannot be forgotten when a new transport or route is added — and so the same limit
 * applies whether the caller used `/trpc` or the REST surface.
 *
 * The default store is in-process, which is correct for a single instance. Behind more
 * than one instance, pass a shared store to `setRateLimitStore` or the limits become
 * per-instance and therefore weaker than they look.
 */

export interface RateLimitPolicy {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** What to call the bucket in error messages. */
  name: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch milliseconds at which the current window ends. */
  resetAt: number;
}

export interface RateLimitStore {
  /** Records a hit and reports whether it is within the policy. */
  hit: (key: string, policy: RateLimitPolicy) => Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window counter. Fixed rather than sliding: it needs one number per key instead of
 * a list of timestamps, which keeps memory flat under a flood.
 */
class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  /** Evict expired buckets so the map cannot grow without bound. */
  constructor(private readonly sweepIntervalMs = 60_000) {
    const timer = setInterval(() => this.sweep(), sweepIntervalMs);
    // Never hold the process open just to sweep.
    timer.unref?.();
  }

  async hit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const bucket = { count: 1, resetAt: now + policy.windowMs };
      this.buckets.set(key, bucket);
      return {
        allowed: true,
        remaining: Math.max(0, policy.limit - 1),
        resetAt: bucket.resetAt,
      };
    }

    existing.count += 1;
    return {
      allowed: existing.count <= policy.limit,
      remaining: Math.max(0, policy.limit - existing.count),
      resetAt: existing.resetAt,
    };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

let store: RateLimitStore = new InMemoryRateLimitStore();

/** Swap in a shared store when running more than one instance. */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

/** Test seam: forget every bucket. */
export function resetRateLimits(): void {
  store = new InMemoryRateLimitStore();
}

// ── Policies ───────────────────────────────────────────────────────────────────

const MINUTE = 60_000;

/** Reading a form or session. Generous: a real respondent cannot exhaust this. */
export const RATE_LIMITS = {
  /** Any public read: viewing a form, starting or resuming a session, saving a draft. */
  public: { name: "public", limit: 120, windowMs: 5 * MINUTE },
  /**
   * Password guessing and spam submissions. Deliberately tight, and keyed on IP alone
   * so a locked-out attacker cannot spread attempts across many devices.
   */
  sensitive: { name: "sensitive", limit: 10, windowMs: 5 * MINUTE },
} satisfies Record<string, RateLimitPolicy>;

/**
 * Records a hit for `key` and throws when the caller is over the limit.
 *
 * Deliberately transport-agnostic — it knows nothing about tRPC — so the tRPC layer can
 * wrap it, and so it can be exercised directly in a test.
 */
export function createRateLimiter(policy: RateLimitPolicy) {
  return async function consume(key: string): Promise<void> {
    const result = await store.hit(`${policy.name}:${key}`, policy);

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many ${policy.name} requests. Try again in ${retryAfterSeconds}s.`,
      });
    }
  };
}
