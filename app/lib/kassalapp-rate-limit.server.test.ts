import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getKassalappRateLimiterStats,
  kassalappRateLimitConfig,
  resetKassalappRateLimiterForTests,
  scheduleKassalappRequest,
} from "./kassalapp-rate-limit.server";
import { KassalappApiError } from "./kassalapp.types";

const TEST_RATE_LIMIT_KEY = "test-family";

describe("kassalapp-rate-limit.server", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetKassalappRateLimiterForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetKassalappRateLimiterForTests();
  });

  it("allows up to 60 calls inside the window", async () => {
    let callCount = 0;

    await Promise.all(
      Array.from({ length: kassalappRateLimitConfig.maxCalls }, () =>
        scheduleKassalappRequest({
          rateLimitKey: TEST_RATE_LIMIT_KEY,
          request: async () => {
            callCount += 1;
          },
        }),
      ),
    );

    expect(callCount).toBe(kassalappRateLimitConfig.maxCalls);
    expect(getKassalappRateLimiterStats(TEST_RATE_LIMIT_KEY).activeCallsInWindow).toBe(
      kassalappRateLimitConfig.maxCalls,
    );
  });

  it("queues calls beyond the per-minute limit", async () => {
    let callCount = 0;
    const pendingCalls = Array.from({ length: 61 }, () =>
      scheduleKassalappRequest({
        rateLimitKey: TEST_RATE_LIMIT_KEY,
        request: async () => {
          callCount += 1;
        },
      }),
    );

    await Promise.resolve();
    expect(callCount).toBe(60);
    expect(getKassalappRateLimiterStats(TEST_RATE_LIMIT_KEY).queuedCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(kassalappRateLimitConfig.windowMs + 1);
    await Promise.all(pendingCalls);

    expect(callCount).toBe(61);
  });

  it("isolates rate limits per family key", async () => {
    let firstFamilyCalls = 0;
    let secondFamilyCalls = 0;

    await Promise.all(
      Array.from({ length: kassalappRateLimitConfig.maxCalls }, () =>
        scheduleKassalappRequest({
          rateLimitKey: "family-1",
          request: async () => {
            firstFamilyCalls += 1;
          },
        }),
      ),
    );

    await scheduleKassalappRequest({
      rateLimitKey: "family-2",
      request: async () => {
        secondFamilyCalls += 1;
      },
    });

    expect(firstFamilyCalls).toBe(kassalappRateLimitConfig.maxCalls);
    expect(secondFamilyCalls).toBe(1);
    expect(getKassalappRateLimiterStats("family-1").queuedCalls).toBe(0);
  });

  it("retries rate-limited responses with backoff", async () => {
    let attempts = 0;

    const resultPromise = scheduleKassalappRequest({
      rateLimitKey: TEST_RATE_LIMIT_KEY,
      request: async () => {
        attempts += 1;

        if (attempts === 1) {
          throw new KassalappApiError("Too many requests", 429);
        }

        return "ok";
      },
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(resultPromise).resolves.toBe("ok");
    expect(attempts).toBe(2);
  });
});
