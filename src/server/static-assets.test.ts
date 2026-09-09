import { describe, expect, it } from "vitest";
import { isHtmlMasqueradingAsAsset } from "@/shared/pwa.ts";
import { envAssets, isHashedAssetPath, serveHashedAsset } from "./static-assets.ts";

describe("isHashedAssetPath", () => {
  it("assets 配下だけ見る", () => {
    expect(isHashedAssetPath("/assets/main.js")).toBe(true);
    expect(isHashedAssetPath("/assets")).toBe(true);
    expect(isHashedAssetPath("/api/health")).toBe(false);
    expect(isHashedAssetPath("/login")).toBe(false);
  });
});

describe("isHtmlMasqueradingAsAsset", () => {
  it("HTML 応答を検知する", () => {
    expect(isHtmlMasqueradingAsAsset("text/html; charset=utf-8")).toBe(true);
    expect(isHtmlMasqueradingAsAsset("text/javascript; charset=utf-8")).toBe(false);
    expect(isHtmlMasqueradingAsAsset(null)).toBe(false);
  });
});

describe("serveHashedAsset", () => {
  it("HTML を 404 にする", async () => {
    const response = await serveHashedAsset(new Request("https://example.test/assets/old.js"), {
      ASSETS: {
        fetch: async () =>
          new Response("<!doctype html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      },
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("本物の JS はそのまま返す", async () => {
    const response = await serveHashedAsset(new Request("https://example.test/assets/main.js"), {
      ASSETS: {
        fetch: async () =>
          new Response("ok", { status: 200, headers: { "content-type": "text/javascript" } }),
      },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  it("ASSETS が無いときは 404", async () => {
    const response = await serveHashedAsset(new Request("https://example.test/assets/main.js"), {});
    expect(response.status).toBe(404);
    expect(envAssets({})).toBeUndefined();
  });
});
