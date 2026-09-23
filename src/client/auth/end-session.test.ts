import { describe, expect, it, vi } from "vitest";
import { createEndSessionHandler } from "./end-session.ts";

describe("createEndSessionHandler", () => {
  it("signOut が成功したら store の再取得は signOut 側に任せる", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const refreshSession = vi.fn();
    const endSession = createEndSessionHandler({
      signOut,
      refreshSession,
      clearBadge: vi.fn(),
      clearPush: vi.fn(),
    });

    await endSession();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("signOut がエラー応答（Cookie 消失など）でもセッション store を再取得させる", async () => {
    const signOut = vi.fn(async () => ({ error: { status: 400 } }));
    const refreshSession = vi.fn();
    const endSession = createEndSessionHandler({
      signOut,
      refreshSession,
      clearBadge: vi.fn(),
      clearPush: vi.fn(),
    });

    await endSession();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("signOut が reject しても投げずに store を再取得させる", async () => {
    const signOut = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const refreshSession = vi.fn();
    const endSession = createEndSessionHandler({
      signOut,
      refreshSession,
      clearBadge: vi.fn(),
      clearPush: vi.fn(),
    });

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
    const endSession = createEndSessionHandler({
      signOut,
      refreshSession: vi.fn(),
      clearBadge: vi.fn(),
      clearPush: vi.fn(),
    });

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

  it("ログアウト（401 の自動ログアウトを含む）ではサインアウト前にアイコンのバッジを消す", async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => {
      order.push("signOut");
      return { error: null };
    });
    const clearBadge = vi.fn(() => {
      order.push("clearBadge");
    });
    const endSession = createEndSessionHandler({
      signOut,
      refreshSession: vi.fn(),
      clearBadge,
      clearPush: vi.fn(),
    });

    await endSession();
    expect(clearBadge).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["clearBadge", "signOut"]);
  });

  it("サインアウトが失敗してもバッジは消えている", async () => {
    const clearBadge = vi.fn();
    const endSession = createEndSessionHandler({
      signOut: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
      refreshSession: vi.fn(),
      clearBadge,
      clearPush: vi.fn(),
    });

    await endSession();
    expect(clearBadge).toHaveBeenCalledTimes(1);
  });

  it("ログアウトでは端末のプッシュ購読もサインアウト前に解除し、待たない", async () => {
    const order: string[] = [];
    const endSession = createEndSessionHandler({
      signOut: vi.fn(async () => {
        order.push("signOut");
        return { error: null };
      }),
      refreshSession: vi.fn(),
      clearBadge: vi.fn(),
      clearPush: vi.fn(() => {
        order.push("clearPush");
      }),
    });
    await endSession();
    expect(order).toEqual(["clearPush", "signOut"]);
  });
});
