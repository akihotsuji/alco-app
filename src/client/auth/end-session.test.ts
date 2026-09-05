import { describe, expect, it, vi } from "vitest";
import { createEndSessionHandler } from "./end-session.ts";

describe("createEndSessionHandler", () => {
  it("signOut が成功したら store の再取得は signOut 側に任せる", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const refreshSession = vi.fn();
    const endSession = createEndSessionHandler({ signOut, refreshSession });

    await endSession();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("signOut がエラー応答（Cookie 消失など）でもセッション store を再取得させる", async () => {
    const signOut = vi.fn(async () => ({ error: { status: 400 } }));
    const refreshSession = vi.fn();
    const endSession = createEndSessionHandler({ signOut, refreshSession });

    await endSession();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("signOut が reject しても投げずに store を再取得させる", async () => {
    const signOut = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const refreshSession = vi.fn();
    const endSession = createEndSessionHandler({ signOut, refreshSession });

    await expect(endSession()).resolves.toBeUndefined();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("同時に複数回呼ばれても signOut は 1 回だけ", async () => {
    let resolveSignOut: (value: { error: null }) => void = () => undefined;
    const signOut = vi.fn(async () => ({ error: null }));
    signOut.mockImplementationOnce(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const endSession = createEndSessionHandler({ signOut, refreshSession: vi.fn() });

    const first = endSession();
    const second = endSession();
    expect(first).toBe(second);
    expect(signOut).toHaveBeenCalledTimes(1);

    resolveSignOut({ error: null });
    await Promise.all([first, second]);

    // 完了後の呼び出しは改めて処理する
    await endSession();
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
