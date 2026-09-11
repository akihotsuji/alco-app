import {
  CELLAR_CREATE_RATE_MAX,
  CELLAR_CREATE_RATE_WINDOW_MS,
  CELLAR_INVITE_CREATE_RATE_MAX,
  CELLAR_INVITE_CREATE_RATE_WINDOW_MS,
  CELLAR_INVITE_USE_RATE_MAX,
  CELLAR_INVITE_USE_RATE_WINDOW_MS,
} from "@/shared/constants.ts";

function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    consume(userId: string, now = Date.now()): boolean {
      const windowStart = now - windowMs;
      const recent = (hits.get(userId) ?? []).filter((time) => time > windowStart);
      if (recent.length >= max) {
        hits.set(userId, recent);
        return false;
      }
      recent.push(now);
      hits.set(userId, recent);
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}

export const cellarCreateRateLimiter = createLimiter(
  CELLAR_CREATE_RATE_MAX,
  CELLAR_CREATE_RATE_WINDOW_MS,
);
export const cellarInviteCreateRateLimiter = createLimiter(
  CELLAR_INVITE_CREATE_RATE_MAX,
  CELLAR_INVITE_CREATE_RATE_WINDOW_MS,
);
export const cellarInviteUseRateLimiter = createLimiter(
  CELLAR_INVITE_USE_RATE_MAX,
  CELLAR_INVITE_USE_RATE_WINDOW_MS,
);
