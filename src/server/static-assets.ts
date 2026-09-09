import { isHtmlMasqueradingAsAsset } from "@/shared/pwa.ts";

export type AssetFetcher = {
  fetch: (input: Request) => Promise<Response>;
};

const NOT_FOUND_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export function notFoundAssetResponse(): Response {
  return new Response("Not found", { status: 404, headers: NOT_FOUND_HEADERS });
}

export function envAssets(env: object): AssetFetcher | undefined {
  if (!("ASSETS" in env)) {
    return undefined;
  }
  const assets = (env as { ASSETS?: AssetFetcher }).ASSETS;
  if (!assets || typeof assets.fetch !== "function") {
    return undefined;
  }
  return assets;
}

/** ハッシュ付き資産。SPA の HTML を JS / CSS として返さない */
export async function serveHashedAsset(request: Request, env: object): Promise<Response> {
  const assets = envAssets(env);
  if (!assets) {
    return notFoundAssetResponse();
  }
  const response = await assets.fetch(request);
  if (isHtmlMasqueradingAsAsset(response.headers.get("content-type"))) {
    return notFoundAssetResponse();
  }
  return response;
}

export function isHashedAssetPath(pathname: string): boolean {
  return pathname === "/assets" || pathname.startsWith("/assets/");
}
