/**
 * 本番ホストの正規化。正本は spec/features/custom-domain.md。
 * 行き先の origin は設定値だけを使い、リクエストの Host を信用しない。
 */

const CANONICAL_ORIGIN_KEY = "CANONICAL_ORIGIN";

function readOptionalString(env: object, key: string): string | undefined {
  const value = Reflect.get(env, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readCanonicalOrigin(env: object): string | undefined {
  const configured = readOptionalString(env, CANONICAL_ORIGIN_KEY);
  if (!configured) {
    return undefined;
  }
  return configured.replace(/\/$/, "");
}

export function parseHttpsOrigin(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }
    if (url.pathname !== "/" || url.search || url.hash) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

export function resolveCanonicalRedirectUrl(
  requestUrl: string,
  canonicalOrigin: string | undefined,
): string | undefined {
  if (!canonicalOrigin) {
    return undefined;
  }
  const canonical = parseHttpsOrigin(canonicalOrigin);
  if (!canonical) {
    return undefined;
  }

  let incoming: URL;
  try {
    incoming = new URL(requestUrl);
  } catch {
    return undefined;
  }

  const incomingHost = incoming.hostname.toLowerCase();
  const canonicalHost = canonical.hostname.toLowerCase();
  const isWww = incomingHost === `www.${canonicalHost}`;
  const isWorkersDev = incomingHost.endsWith(".workers.dev");
  const isHttpOnCanonical = incomingHost === canonicalHost && incoming.protocol === "http:";

  if (!isWww && !isWorkersDev && !isHttpOnCanonical) {
    return undefined;
  }

  const dest = new URL(canonical.origin);
  dest.pathname = incoming.pathname;
  dest.search = incoming.search;
  return dest.href;
}

export function canonicalRedirectResponse(requestUrl: string, env: object): Response | undefined {
  const dest = resolveCanonicalRedirectUrl(requestUrl, readCanonicalOrigin(env));
  if (!dest) {
    return undefined;
  }
  return new Response(null, {
    status: 308,
    headers: {
      Location: dest,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
