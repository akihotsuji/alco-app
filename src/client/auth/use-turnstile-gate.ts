import { useState } from "react";
import { usePublicConfig } from "@/client/hooks/use-public-config.ts";

export const TURNSTILE_LOAD_ERROR_MESSAGE = "確認の読み込みに失敗しました。時間をおいて再度お試しください";
export const TURNSTILE_REQUIRED_MESSAGE = "確認を完了してください";

export function useTurnstileGate() {
  const query = usePublicConfig();
  const [token, setToken] = useState<string | null>(null);
  const siteKey = query.data?.turnstileSiteKey ?? null;
  const required = Boolean(siteKey);
  const ready = query.isSuccess;
  const blocked = query.isError;
  const satisfied = !required || Boolean(token);

  return {
    siteKey,
    token,
    setToken,
    required,
    ready,
    blocked,
    satisfied,
    canAct: ready && !blocked && satisfied,
  };
}
