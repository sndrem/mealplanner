const KASSALAPP_RATE_LIMIT_MAX_CALLS = 60;
const KASSALAPP_RATE_LIMIT_WINDOW_MS = 60_000;
const KASSALAPP_RATE_LIMIT_MAX_RETRIES = 3;
const KASSALAPP_RATE_LIMIT_INITIAL_BACKOFF_MS = 1_000;

interface RateLimiterWaiter {
  reject: (error: unknown) => void;
  resolve: () => void;
}

interface RateLimiterBucket {
  callTimestamps: number[];
  drainTimer: ReturnType<typeof setTimeout> | null;
  waitQueue: RateLimiterWaiter[];
}

const buckets = new Map<string, RateLimiterBucket>();

function getRateLimiterBucket(rateLimitKey: string) {
  const existingBucket = buckets.get(rateLimitKey);

  if (existingBucket) {
    return existingBucket;
  }

  const bucket: RateLimiterBucket = {
    callTimestamps: [],
    drainTimer: null,
    waitQueue: [],
  };
  buckets.set(rateLimitKey, bucket);

  return bucket;
}

function pruneExpiredCalls(bucket: RateLimiterBucket, now: number) {
  const windowStart = now - KASSALAPP_RATE_LIMIT_WINDOW_MS;

  while (
    bucket.callTimestamps.length > 0 &&
    bucket.callTimestamps[0]! < windowStart
  ) {
    bucket.callTimestamps.shift();
  }
}

function scheduleDrain(rateLimitKey: string, now = Date.now()) {
  const bucket = getRateLimiterBucket(rateLimitKey);

  if (bucket.drainTimer !== null) {
    return;
  }

  pruneExpiredCalls(bucket, now);

  if (bucket.callTimestamps.length < KASSALAPP_RATE_LIMIT_MAX_CALLS) {
    while (
      bucket.waitQueue.length > 0 &&
      bucket.callTimestamps.length < KASSALAPP_RATE_LIMIT_MAX_CALLS
    ) {
      bucket.callTimestamps.push(Date.now());
      bucket.waitQueue.shift()?.resolve();
    }

    return;
  }

  const oldestCall = bucket.callTimestamps[0] ?? now;
  const delayMs = Math.max(
    0,
    oldestCall + KASSALAPP_RATE_LIMIT_WINDOW_MS - now,
  );

  bucket.drainTimer = setTimeout(() => {
    bucket.drainTimer = null;
    scheduleDrain(rateLimitKey);
  }, delayMs);
}

async function waitForRateLimitSlot(rateLimitKey: string) {
  const bucket = getRateLimiterBucket(rateLimitKey);
  pruneExpiredCalls(bucket, Date.now());

  if (bucket.callTimestamps.length < KASSALAPP_RATE_LIMIT_MAX_CALLS) {
    bucket.callTimestamps.push(Date.now());
    return;
  }

  await new Promise<void>((resolve, reject) => {
    bucket.waitQueue.push({ reject, resolve });
    scheduleDrain(rateLimitKey);
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function resetKassalappRateLimiterForTests() {
  for (const bucket of buckets.values()) {
    if (bucket.drainTimer !== null) {
      clearTimeout(bucket.drainTimer);
    }
  }

  buckets.clear();
}

export function getKassalappRateLimiterStats(rateLimitKey = "default") {
  const bucket = getRateLimiterBucket(rateLimitKey);
  pruneExpiredCalls(bucket, Date.now());

  return {
    activeCallsInWindow: bucket.callTimestamps.length,
    queuedCalls: bucket.waitQueue.length,
  };
}

export async function scheduleKassalappRequest<T>({
  rateLimitKey,
  request,
}: {
  rateLimitKey: string;
  request: () => Promise<T>;
}): Promise<T> {
  let backoffMs = KASSALAPP_RATE_LIMIT_INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= KASSALAPP_RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    await waitForRateLimitSlot(rateLimitKey);

    try {
      return await request();
    } catch (error) {
      const isRateLimited =
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 429;

      if (!isRateLimited || attempt === KASSALAPP_RATE_LIMIT_MAX_RETRIES) {
        throw error;
      }

      await sleep(backoffMs);
      backoffMs *= 2;
    }
  }

  throw new Error("Kassalapp rate limit retries exhausted.");
}

export const kassalappRateLimitConfig = {
  maxCalls: KASSALAPP_RATE_LIMIT_MAX_CALLS,
  windowMs: KASSALAPP_RATE_LIMIT_WINDOW_MS,
};
