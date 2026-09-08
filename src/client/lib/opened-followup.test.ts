import { afterEach, describe, expect, it } from "vitest";
import {
  clearOpenedFollowup,
  markOpenedFollowupDismissed,
  markOpenedFollowupPending,
  shouldShowOpenedFollowup,
} from "./opened-followup";

const memory = new Map<string, string>();
const sessionStorageStub = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
  removeItem(key: string) {
    memory.delete(key);
  },
};

afterEach(() => {
  memory.clear();
});

describe("opened-followup", () => {
  it("保存直後の pending だけ案内を出す", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: sessionStorageStub,
    });
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
    markOpenedFollowupPending("b1");
    expect(shouldShowOpenedFollowup("b1")).toBe(true);
  });

  it("閉じたら同じセッションでは再表示しない", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: sessionStorageStub,
    });
    markOpenedFollowupPending("b1");
    markOpenedFollowupDismissed("b1");
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
  });

  it("別ボトルの状態は独立する", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: sessionStorageStub,
    });
    markOpenedFollowupPending("b1");
    markOpenedFollowupDismissed("b1");
    markOpenedFollowupPending("b2");
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
    expect(shouldShowOpenedFollowup("b2")).toBe(true);
  });

  it("clear すると未表示に戻る", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: sessionStorageStub,
    });
    markOpenedFollowupPending("b1");
    clearOpenedFollowup("b1");
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
  });
});
