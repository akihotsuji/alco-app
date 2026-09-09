import { describe, expect, it } from "vitest";
import { PROD_CANONICAL_ORIGIN } from "@/shared/prod-canonical.ts";
import {
  canonicalRedirectResponse,
  parseHttpsOrigin,
  readCanonicalOrigin,
  resolveCanonicalRedirectUrl,
} from "./canonical-redirect.ts";

describe("readCanonicalOrigin", () => {
  it("未設定・空文字は無し", () => {
    expect(readCanonicalOrigin({})).toBeUndefined();
    expect(readCanonicalOrigin({ CANONICAL_ORIGIN: "" })).toBeUndefined();
    expect(readCanonicalOrigin({ CANONICAL_ORIGIN: 1 })).toBeUndefined();
  });

  it("末尾スラッシュを除く", () => {
    expect(readCanonicalOrigin({ CANONICAL_ORIGIN: `${PROD_CANONICAL_ORIGIN}/` })).toBe(
      PROD_CANONICAL_ORIGIN,
    );
  });
});

describe("parseHttpsOrigin", () => {
  it("https の origin だけ通す", () => {
    expect(parseHttpsOrigin(PROD_CANONICAL_ORIGIN)?.origin).toBe(PROD_CANONICAL_ORIGIN);
    expect(parseHttpsOrigin("http://sake-shiori.com")).toBeUndefined();
    expect(parseHttpsOrigin("https://sake-shiori.com/path")).toBeUndefined();
    expect(parseHttpsOrigin("https://user:pass@sake-shiori.com")).toBeUndefined();
    expect(parseHttpsOrigin("not-a-url")).toBeUndefined();
  });
});

describe("resolveCanonicalRedirectUrl", () => {
  it("未設定ならリダイレクトしない（dev）", () => {
    expect(
      resolveCanonicalRedirectUrl("https://example.workers.dev/login", undefined),
    ).toBeUndefined();
  });

  it("apex の https はそのまま", () => {
    expect(
      resolveCanonicalRedirectUrl(`${PROD_CANONICAL_ORIGIN}/login`, PROD_CANONICAL_ORIGIN),
    ).toBeUndefined();
  });

  it("www と workers.dev と http apex を https apex へ寄せる", () => {
    expect(
      resolveCanonicalRedirectUrl("https://www.sake-shiori.com/login?x=1", PROD_CANONICAL_ORIGIN),
    ).toBe(`${PROD_CANONICAL_ORIGIN}/login?x=1`);
    expect(
      resolveCanonicalRedirectUrl(
        "https://alco-app-prod.example.workers.dev/api/health",
        PROD_CANONICAL_ORIGIN,
      ),
    ).toBe(`${PROD_CANONICAL_ORIGIN}/api/health`);
    expect(resolveCanonicalRedirectUrl("http://sake-shiori.com/", PROD_CANONICAL_ORIGIN)).toBe(
      `${PROD_CANONICAL_ORIGIN}/`,
    );
  });

  it("未知ホストや localhost は飛ばさない", () => {
    expect(
      resolveCanonicalRedirectUrl("https://evil.example/login", PROD_CANONICAL_ORIGIN),
    ).toBeUndefined();
    expect(
      resolveCanonicalRedirectUrl("http://localhost:5173/login", PROD_CANONICAL_ORIGIN),
    ).toBeUndefined();
  });

  it("パスの // を別オリジンにしない", () => {
    const dest = resolveCanonicalRedirectUrl(
      "https://www.sake-shiori.com//evil.example",
      PROD_CANONICAL_ORIGIN,
    );
    expect(dest).toBeDefined();
    expect(new URL(dest ?? "").origin).toBe(PROD_CANONICAL_ORIGIN);
  });
});

describe("canonicalRedirectResponse", () => {
  it("308 と Location を返す", () => {
    const response = canonicalRedirectResponse("https://www.sake-shiori.com/notes", {
      CANONICAL_ORIGIN: PROD_CANONICAL_ORIGIN,
    });
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe(`${PROD_CANONICAL_ORIGIN}/notes`);
  });

  it("dev では Response を作らない", () => {
    expect(canonicalRedirectResponse("https://example.workers.dev/", {})).toBeUndefined();
  });
});
