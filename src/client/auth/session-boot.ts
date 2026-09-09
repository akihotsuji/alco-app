export type SessionBootKind = "loading" | "slow" | "unavailable" | "guest" | "authenticated";

export type SessionBootInput = {
  isPending: boolean;
  isRefetching: boolean;
  hasSession: boolean;
  error: { status?: number } | null;
  elapsedMs: number;
  slowAfterMs: number;
};

function isUnauthorizedError(error: { status?: number } | null): boolean {
  return error?.status === 401;
}

/**
 * 通信失敗と未ログインを分ける。待ち時間が長いだけ、または refetch 中はログアウトにしない。
 */
export function resolveSessionBoot(input: SessionBootInput): SessionBootKind {
  if (input.hasSession) {
    return "authenticated";
  }
  const waiting = input.isPending || input.isRefetching;
  if (input.error && !isUnauthorizedError(input.error)) {
    if (waiting) {
      return input.elapsedMs >= input.slowAfterMs ? "slow" : "loading";
    }
    return "unavailable";
  }
  if (waiting) {
    return input.elapsedMs >= input.slowAfterMs ? "slow" : "loading";
  }
  return "guest";
}

export function authBootVariant(kind: SessionBootKind): "loading" | "slow" | "failed" | null {
  if (kind === "loading") {
    return "loading";
  }
  if (kind === "slow") {
    return "slow";
  }
  if (kind === "unavailable") {
    return "failed";
  }
  return null;
}
