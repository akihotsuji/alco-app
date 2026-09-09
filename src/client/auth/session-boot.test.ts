import { describe, expect, it } from "vitest";
import { authBootVariant, resolveSessionBoot } from "./session-boot.ts";

const slowAfterMs = 8_000;

describe("resolveSessionBoot", () => {
  it("セッションがあれば認証済み", () => {
    expect(
      resolveSessionBoot({
        isPending: false,
        isRefetching: false,
        hasSession: true,
        error: { status: 500 },
        elapsedMs: 20_000,
        slowAfterMs,
      }),
    ).toBe("authenticated");
  });

  it("待ち中は未ログインにしない", () => {
    expect(
      resolveSessionBoot({
        isPending: true,
        isRefetching: false,
        hasSession: false,
        error: null,
        elapsedMs: 100,
        slowAfterMs,
      }),
    ).toBe("loading");
    expect(
      resolveSessionBoot({
        isPending: true,
        isRefetching: false,
        hasSession: false,
        error: null,
        elapsedMs: slowAfterMs,
        slowAfterMs,
      }),
    ).toBe("slow");
  });

  it("通信失敗と 401 未ログインを分ける", () => {
    expect(
      resolveSessionBoot({
        isPending: false,
        isRefetching: false,
        hasSession: false,
        error: { status: 500 },
        elapsedMs: 100,
        slowAfterMs,
      }),
    ).toBe("unavailable");
    expect(
      resolveSessionBoot({
        isPending: false,
        isRefetching: false,
        hasSession: false,
        error: { status: 401 },
        elapsedMs: 100,
        slowAfterMs,
      }),
    ).toBe("guest");
    expect(
      resolveSessionBoot({
        isPending: false,
        isRefetching: false,
        hasSession: false,
        error: null,
        elapsedMs: 100,
        slowAfterMs,
      }),
    ).toBe("guest");
  });

  it("失敗後の再試行中はログアウトにしない", () => {
    expect(
      resolveSessionBoot({
        isPending: false,
        isRefetching: true,
        hasSession: false,
        error: { status: 0 },
        elapsedMs: 100,
        slowAfterMs,
      }),
    ).toBe("loading");
  });
});

describe("authBootVariant", () => {
  it("画面を出す状態だけ variant になる", () => {
    expect(authBootVariant("loading")).toBe("loading");
    expect(authBootVariant("slow")).toBe("slow");
    expect(authBootVariant("unavailable")).toBe("failed");
    expect(authBootVariant("guest")).toBeNull();
    expect(authBootVariant("authenticated")).toBeNull();
  });
});
