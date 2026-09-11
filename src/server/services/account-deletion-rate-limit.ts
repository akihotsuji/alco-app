import {
  ACCOUNT_DELETION_RATE_MAX,
  ACCOUNT_DELETION_RATE_WINDOW_MS,
} from "@/shared/account-deletion.ts";

export function createAccountDeletionRateLimiter() {
  const hits = new Map<string, number[]>();
  return {
    consume(userId: string, now = Date.now()): boolean {
      const windowStart = now - ACCOUNT_DELETION_RATE_WINDOW_MS;
      const recent = (hits.get(userId) ?? []).filter((time) => time > windowStart);
      if (recent.length >= ACCOUNT_DELETION_RATE_MAX) {
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

export const accountDeletionRateLimiter = createAccountDeletionRateLimiter();
