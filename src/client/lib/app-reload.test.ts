import { describe, expect, it, vi } from "vitest";
import {
  decideAppReload,
  parseReloadRecord,
  requestAppReload,
  serializeReloadRecord,
} from "./app-reload.ts";

describe("decideAppReload", () => {
  it("未保存がある更新は再読み込みせず通知する", () => {
    expect(
      decideAppReload({
        reason: "sw-update",
        last: null,
        now: 1_000,
        cooldownMs: 15_000,
        leaveGuardActive: true,
      }),
    ).toBe("notify-dirty");
  });

  it("クールダウン中の自動再読み込みはループしない", () => {
    expect(
      decideAppReload({
        reason: "sw-update",
        last: { reason: "sw-update", at: 1_000 },
        now: 2_000,
        cooldownMs: 15_000,
        leaveGuardActive: false,
      }),
    ).toBe("skip-loop");
    expect(
      decideAppReload({
        reason: "asset",
        last: { reason: "asset", at: 1_000 },
        now: 2_000,
        cooldownMs: 15_000,
        leaveGuardActive: false,
      }),
    ).toBe("skip-loop");
  });

  it("ユーザー操作の再試行はクールダウンを越える", () => {
    expect(
      decideAppReload({
        reason: "user",
        last: { reason: "asset", at: 1_000 },
        now: 2_000,
        cooldownMs: 15_000,
        leaveGuardActive: false,
      }),
    ).toBe("reload");
  });
});

describe("requestAppReload", () => {
  it("記録して reload する", () => {
    const storage = new Map<string, string>();
    const reload = vi.fn();
    const decision = requestAppReload("sw-update", {
      now: () => 5_000,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
      },
      leaveGuardActive: () => false,
      reload,
    });
    expect(decision).toBe("reload");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(parseReloadRecord([...storage.values()][0] ?? null)).toEqual({
      reason: "sw-update",
      at: 5_000,
    });
  });

  it("未保存なら notify して reload しない", () => {
    const reload = vi.fn();
    const notifyDirty = vi.fn();
    const decision = requestAppReload("sw-update", {
      now: () => 1,
      storage: { getItem: () => null, setItem: () => undefined },
      leaveGuardActive: () => true,
      reload,
      notifyDirty,
    });
    expect(decision).toBe("notify-dirty");
    expect(reload).not.toHaveBeenCalled();
    expect(notifyDirty).toHaveBeenCalledTimes(1);
  });
});

describe("serializeReloadRecord", () => {
  it("往復できる", () => {
    const record = { reason: "asset" as const, at: 42 };
    expect(parseReloadRecord(serializeReloadRecord(record))).toEqual(record);
    expect(parseReloadRecord("nope")).toBeNull();
  });
});
