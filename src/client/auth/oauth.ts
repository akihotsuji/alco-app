import { hrefWithRedirect } from "./login-path.ts";

export function hasOAuthErrorQuery(searchParams: URLSearchParams): boolean {
  return searchParams.has("error") || searchParams.get("oauth") === "1";
}

export function stripOAuthErrorParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete("error");
  next.delete("error_description");
  next.delete("oauth");
  return next;
}

export function oauthErrorCallbackPath(
  path: "/login" | "/signup",
  redirectQuery: string | null,
): string {
  return hrefWithRedirect(path, redirectQuery);
}

/** Better Auth クライアントが error を付けない失敗（未設定プロバイダ等）も失敗と見る。 */
export function oauthClientFailed(result: unknown): {
  failed: boolean;
  status?: number;
} {
  if (!result || typeof result !== "object") {
    return { failed: true };
  }
  const record = result as {
    error?: { status?: number } | null;
    data?: { url?: string } | null;
  };
  if (record.error) {
    return { failed: true, status: record.error.status };
  }
  if (typeof record.data?.url === "string" && record.data.url.length > 0) {
    return { failed: false };
  }
  return { failed: true };
}
