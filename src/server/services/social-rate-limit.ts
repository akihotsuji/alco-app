import {
  SOCIAL_INVITE_CREATE_RATE_MAX,
  SOCIAL_INVITE_CREATE_RATE_WINDOW_MS,
  SOCIAL_REACTION_RATE_MAX,
  SOCIAL_REACTION_RATE_WINDOW_MS,
  SOCIAL_REQUEST_RATE_MAX,
  SOCIAL_REQUEST_RATE_WINDOW_MS,
  SOCIAL_SHARE_RATE_MAX,
  SOCIAL_SHARE_RATE_WINDOW_MS,
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

export const socialInviteCreateRateLimiter = createLimiter(
  SOCIAL_INVITE_CREATE_RATE_MAX,
  SOCIAL_INVITE_CREATE_RATE_WINDOW_MS,
);
export const socialRequestRateLimiter = createLimiter(
  SOCIAL_REQUEST_RATE_MAX,
  SOCIAL_REQUEST_RATE_WINDOW_MS,
);
export const socialReactionRateLimiter = createLimiter(
  SOCIAL_REACTION_RATE_MAX,
  SOCIAL_REACTION_RATE_WINDOW_MS,
);
export const socialShareRateLimiter = createLimiter(
  SOCIAL_SHARE_RATE_MAX,
  SOCIAL_SHARE_RATE_WINDOW_MS,
);
