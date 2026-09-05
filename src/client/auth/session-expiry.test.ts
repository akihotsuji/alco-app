import { describe, expect, it, vi } from "vitest";
import { createSessionExpiryHandler } from "./session-expiry.ts";

describe("createSessionExpiryHandler", () => {
  it("signOut が成功したら store の再取得は signOut 側に任せる", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const refreshSession = vi.fn();
    const expire = createSessionExpiryHandler({ signOut, refreshSession });

    await expire();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("signOut がエラー応答（Cookie 消失など）でもセッション store を再取得させる", async () => {
    const signOut = vi.fn(async () => ({ error: { status: 400 } }));
    const refreshSession = vi.fn();
    const expire = createSessionExpiryHandler({ signOut, refreshSession });

    await expire();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("signOut が reject しても投げずに store を再取得させる", async () => {
    const signOut = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const refreshSession = vi.fn();
    const expire = createSessionExpiryHandler({ signOut, refreshSession });

    await expect(expire()).resolves.toBeUndefined();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("同時に複数の 401 が来ても signOut は 1 回だけ", async () => {
    let resolveSignOut: (value: { error: null }) => void = () => undefined;
    const signOut = vi.fn(async () => ({ error: null }));
    signOut.mockImplementationOnce(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const expire = createSessionExpiryHandler({ signOut, refreshSession: vi.fn() });

    const first = expire();
    const second = expire();
    expect(first).toBe(second);
    expect(signOut).toHaveBeenCalledTimes(1);

    resolveSignOut({ error: null });
    await Promise.all([first, second]);

    // 完了後の 401 は改めて処理する
    await expire();
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
