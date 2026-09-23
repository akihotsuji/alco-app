import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type BadgeNavigator,
  badgeCount,
  clearAppBadge,
  isAppBadgeSupported,
  syncAppBadge,
} from "./app-badge.ts";

function supportedNavigator() {
  const setAppBadge = vi.fn(async (_contents?: number) => {});
  const clearAppBadgeFn = vi.fn(async () => {});
  const nav: BadgeNavigator = { setAppBadge, clearAppBadge: clearAppBadgeFn };
  return { nav, setAppBadge, clearAppBadge: clearAppBadgeFn };
}

describe("badgeCount", () => {
  it("0 以上の整数に丸める。負・NaN・Infinity は 0", () => {
    expect(badgeCount(3)).toBe(3);
    expect(badgeCount(2.9)).toBe(2);
    expect(badgeCount(0)).toBe(0);
    expect(badgeCount(-1)).toBe(0);
    expect(badgeCount(Number.NaN)).toBe(0);
    expect(badgeCount(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("99 を超えても丸めない（表示は OS に任せる）", () => {
    expect(badgeCount(250)).toBe(250);
  });
});

describe("syncAppBadge", () => {
  it("対応環境では件数を setAppBadge に渡す", async () => {
    const { nav, setAppBadge, clearAppBadge: clear } = supportedNavigator();
    await syncAppBadge(4, nav);
    expect(setAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).toHaveBeenCalledWith(4);
    expect(clear).not.toHaveBeenCalled();
  });

  it("0 は clearAppBadge で消す", async () => {
    const { nav, setAppBadge, clearAppBadge: clear } = supportedNavigator();
    await syncAppBadge(0, nav);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it("clearAppBadge が無い実装では setAppBadge(0) で消す", async () => {
    const setAppBadge = vi.fn(async (_contents?: number) => {});
    await syncAppBadge(0, { setAppBadge });
    expect(setAppBadge).toHaveBeenCalledWith(0);
  });

  it("非対応環境（メソッド無し・navigator 無し）では何もせず投げない", async () => {
    await expect(syncAppBadge(5, {})).resolves.toBeUndefined();
    await expect(syncAppBadge(0, {})).resolves.toBeUndefined();
    await expect(syncAppBadge(5, undefined)).resolves.toBeUndefined();
    expect(isAppBadgeSupported({})).toBe(false);
    expect(isAppBadgeSupported(undefined)).toBe(false);
  });

  it("reject（未インストール・権限なし）は握りつぶす", async () => {
    const nav: BadgeNavigator = {
      setAppBadge: vi.fn(async () => {
        throw new DOMException("denied", "NotAllowedError");
      }),
      clearAppBadge: vi.fn(async () => {
        throw new DOMException("denied", "NotAllowedError");
      }),
    };
    await expect(syncAppBadge(2, nav)).resolves.toBeUndefined();
    await expect(syncAppBadge(0, nav)).resolves.toBeUndefined();
  });

  it("同期的な例外も握りつぶす", async () => {
    const nav: BadgeNavigator = {
      setAppBadge: () => {
        throw new TypeError("Illegal invocation");
      },
    };
    await expect(syncAppBadge(1, nav)).resolves.toBeUndefined();
  });

  it("navigator のメソッドとして呼ぶ（this を外さない）", async () => {
    const calls: unknown[] = [];
    const nav = {
      setAppBadge(this: unknown, _contents?: number) {
        calls.push(this);
        return Promise.resolve();
      },
    };
    await syncAppBadge(1, nav);
    expect(calls[0]).toBe(nav);
  });
});

describe("clearAppBadge（ログアウト・アカウント削除）", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "setAppBadge");
    Reflect.deleteProperty(navigator, "clearAppBadge");
  });

  it("対応環境ではバッジを消す", async () => {
    const { nav, clearAppBadge: clear } = supportedNavigator();
    await clearAppBadge(nav);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("既定ではブラウザの navigator を使う", async () => {
    const clear = vi.fn(async () => {});
    Object.defineProperty(navigator, "clearAppBadge", { configurable: true, value: clear });
    await clearAppBadge();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("Node の navigator（非対応）でも投げない", async () => {
    expect(isAppBadgeSupported()).toBe(false);
    await expect(clearAppBadge()).resolves.toBeUndefined();
  });
});
