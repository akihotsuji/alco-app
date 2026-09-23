import { describe, expect, it, vi } from "vitest";
import { navigateAfterSignIn } from "./after-sign-in.ts";

describe("navigateAfterSignIn", () => {
  it("セッションの取り直しが終わってから遷移する", async () => {
    const order: string[] = [];
    let finishRefetch: () => void = () => {};
    const refetch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefetch = () => {
            order.push("refetched");
            resolve();
          };
        }),
    );
    const go = vi.fn(() => order.push("navigated"));

    const pending = navigateAfterSignIn(refetch, go);
    await Promise.resolve();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();

    finishRefetch();
    await pending;
    expect(order).toEqual(["refetched", "navigated"]);
  });

  it("取り直しが失敗しても遷移は止めない", async () => {
    const go = vi.fn();
    await expect(
      navigateAfterSignIn(() => Promise.reject(new Error("offline")), go),
    ).resolves.toBeUndefined();
    expect(go).toHaveBeenCalledTimes(1);
  });
});
