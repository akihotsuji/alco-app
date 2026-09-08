import { afterEach, describe, expect, it } from "vitest";
import {
  clearOpenedFollowup,
  markOpenedFollowupDismissed,
  markOpenedFollowupPending,
  shouldShowOpenedFollowup,
} from "./opened-followup";

afterEach(() => {
  sessionStorage.clear();
});

describe("opened-followup", () => {
  it("保存直後の pending だけ案内を出す", () => {
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
    markOpenedFollowupPending("b1");
    expect(shouldShowOpenedFollowup("b1")).toBe(true);
  });

  it("閉じたら同じセッションでは再表示しない", () => {
    markOpenedFollowupPending("b1");
    markOpenedFollowupDismissed("b1");
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
  });

  it("別ボトルの状態は独立する", () => {
    markOpenedFollowupPending("b1");
    markOpenedFollowupDismissed("b1");
    markOpenedFollowupPending("b2");
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
    expect(shouldShowOpenedFollowup("b2")).toBe(true);
  });

  it("clear すると未表示に戻る", () => {
    markOpenedFollowupPending("b1");
    clearOpenedFollowup("b1");
    expect(shouldShowOpenedFollowup("b1")).toBe(false);
  });
});
