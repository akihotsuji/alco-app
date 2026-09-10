import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema.ts";
import type { AppEnv } from "../app-env.ts";
import { createAgeGuard, createVerifiedUserCache, isAgeExemptApiRoute } from "./age.ts";
import { isPublicApiRoute } from "./auth.ts";
import { errorHandler } from "./error.ts";

vi.mock("../services/age-verification.ts", () => ({
  hasAgeVerification: vi.fn(),
}));

const { hasAgeVerification } = await import("../services/age-verification.ts");
const hasAgeVerificationMock = vi.mocked(hasAgeVerification);

/** サービスはモックするので中身は使わない。型を満たす実物の drizzle を渡す */
const unusedDb = drizzle(createClient({ url: ":memory:" }), { schema });

function buildGuardedApp(userId: string, cache = createVerifiedUserCache()) {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.use("/api/*", async (c, next) => {
    c.set("user", { id: userId, email: "u@example.com", name: "" });
    await next();
  });
  app.use(
    "/api/*",
    createAgeGuard(() => unusedDb, cache),
  );
  app.get("/api/bottles", (c) => c.json({ ok: true }));
  return app;
}

describe("isAgeExemptApiRoute", () => {
  it("公開ルートと me / 確認 API だけ通す", () => {
    expect(isAgeExemptApiRoute("GET", "/api/health")).toBe(true);
    expect(isAgeExemptApiRoute("GET", "/api/config")).toBe(true);
    expect(isAgeExemptApiRoute("POST", "/api/auth/sign-in/email")).toBe(true);
    expect(isAgeExemptApiRoute("GET", "/api/me")).toBe(true);
    expect(isAgeExemptApiRoute("HEAD", "/api/me")).toBe(true);
    expect(isAgeExemptApiRoute("POST", "/api/me/age-verification")).toBe(true);
  });

  it("機能 API は年齢確認が必要", () => {
    expect(isAgeExemptApiRoute("POST", "/api/me")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/me/age-verification")).toBe(false);
    expect(isAgeExemptApiRoute("POST", "/api/drink-logs")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/bottles")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/tasting-notes")).toBe(false);
    expect(isAgeExemptApiRoute("POST", "/api/photos")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/my-drinks")).toBe(false);
  });

  it("公開判定は auth のリストに委譲する", () => {
    expect(isPublicApiRoute("GET", "/api/health")).toBe(true);
    expect(isAgeExemptApiRoute("GET", "/api/health")).toBe(true);
  });
});

describe("createAgeGuard の確認済みキャッシュ", () => {
  it("確認済みは 1 回だけ DB を見て、以降は同じ isolate で再利用する", async () => {
    hasAgeVerificationMock.mockReset();
    hasAgeVerificationMock.mockResolvedValue(true);
    const app = buildGuardedApp("user-verified");

    for (let i = 0; i < 3; i += 1) {
      const res = await app.request("/api/bottles");
      expect(res.status).toBe(200);
    }
    expect(hasAgeVerificationMock).toHaveBeenCalledTimes(1);
  });

  it("未確認（403）は覚えない。確認直後の次のリクエストで即通る", async () => {
    hasAgeVerificationMock.mockReset();
    hasAgeVerificationMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const app = buildGuardedApp("user-pending");

    const denied = await app.request("/api/bottles");
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: "age_required" });

    const allowed = await app.request("/api/bottles");
    expect(allowed.status).toBe(200);
    expect(hasAgeVerificationMock).toHaveBeenCalledTimes(2);
  });

  it("キャッシュはユーザー単位で、別ユーザーには効かない", async () => {
    hasAgeVerificationMock.mockReset();
    hasAgeVerificationMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const cache = createVerifiedUserCache();
    const verifiedApp = buildGuardedApp("user-a", cache);
    const otherApp = buildGuardedApp("user-b", cache);

    expect((await verifiedApp.request("/api/bottles")).status).toBe(200);
    expect((await otherApp.request("/api/bottles")).status).toBe(403);
    expect(hasAgeVerificationMock).toHaveBeenCalledTimes(2);
  });

  it("上限を超えたら古い順に捨てる", () => {
    const cache = createVerifiedUserCache(2);
    cache.add("a");
    cache.add("b");
    cache.add("c");
    expect(cache.size).toBe(2);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
  });
});
