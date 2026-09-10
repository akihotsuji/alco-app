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
