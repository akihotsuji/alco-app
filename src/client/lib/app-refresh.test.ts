import { describe, expect, it, vi } from "vitest";
import { PHOTO_CUTOUT_CACHE } from "@/shared/constants.ts";
import {
  clearWorkboxPrecaches,
  refreshAppToLatest,
  updateServiceWorkerRegistrations,
  waitWithTimeout,
} from "./app-refresh.ts";

describe("waitWithTimeout", () => {
  it("遅い Promise でも打ち切る", async () => {
    const started = Date.now();
    await waitWithTimeout(new Promise(() => undefined), 20);
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe("updateServiceWorkerRegistrations", () => {
  it("各 registration の update を呼ぶ", async () => {
    const update = vi.fn(async () => undefined);
    await updateServiceWorkerRegistrations(async () => [{ update }]);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("clearWorkboxPrecaches", () => {
  it("Workbox だけ消し、切り抜きは残す", async () => {
    const deleted: string[] = [];
    await clearWorkboxPrecaches(
      async () => ["workbox-precache-v2", PHOTO_CUTOUT_CACHE, "other"],
      async (key) => {
        deleted.push(key);
        return true;
      },
    );
    expect(deleted).toEqual(["workbox-precache-v2"]);
  });
});

describe("refreshAppToLatest", () => {
  it("オフラインでは再読み込みしない", async () => {
    const reload = vi.fn();
    const result = await refreshAppToLatest({
      online: false,
      updateRegistrations: async () => undefined,
      clearStalePrecaches: async () => undefined,
      reload,
    });
    expect(result).toBe("offline");
    expect(reload).not.toHaveBeenCalled();
  });

  it("オンラインなら update → 削除 → 再読み込み", async () => {
    const order: string[] = [];
    const result = await refreshAppToLatest({
      online: true,
      updateRegistrations: async () => {
        order.push("update");
      },
      clearStalePrecaches: async () => {
        order.push("clear");
      },
      reload: () => {
        order.push("reload");
        return "reload";
      },
    });
    expect(result).toBe("reload");
    expect(order).toEqual(["update", "clear", "reload"]);
  });
});
