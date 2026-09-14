import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  currentDocumentUrl,
  refreshAppToLatest,
  replaceCurrentDocument,
  updateServiceWorkerRegistrations,
  waitForActivatedServiceWorker,
  waitWithTimeout,
} from "./app-refresh.ts";

const here = dirname(fileURLToPath(import.meta.url));

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

describe("waitForActivatedServiceWorker", () => {
  it("controller が無いときは ready を待たない", async () => {
    const getReady = vi.fn(async () => undefined);
    await waitForActivatedServiceWorker({ hasController: false, getReady });
    expect(getReady).not.toHaveBeenCalled();
  });

  it("controller があるときは ready を待つ", async () => {
    const getReady = vi.fn(async () => undefined);
    await waitForActivatedServiceWorker({ hasController: true, getReady });
    expect(getReady).toHaveBeenCalledTimes(1);
  });
});

describe("currentDocumentUrl", () => {
  it("同一オリジンのパスだけを返す", () => {
    expect(
      currentDocumentUrl({
        pathname: "/settings",
        search: "",
        hash: "",
      }),
    ).toBe("/settings");
    expect(
      currentDocumentUrl({
        pathname: "/settings",
        search: "?from=home",
        hash: "#row",
      }),
    ).toBe("/settings?from=home#row");
  });

  it("不正な pathname は / に落とす", () => {
    expect(
      currentDocumentUrl({
        pathname: "javascript:alert(1)",
        search: "",
        hash: "",
      }),
    ).toBe("/");
  });
});

describe("replaceCurrentDocument", () => {
  it("現在のパスを replace する", () => {
    const replace = vi.fn();
    replaceCurrentDocument({
      location: { pathname: "/settings", search: "", hash: "" },
      replace,
    });
    expect(replace).toHaveBeenCalledWith("/settings");
  });
});

describe("refreshAppToLatest source", () => {
  it("precache 削除と location.reload を使わない", () => {
    const source = readFileSync(join(here, "app-refresh.ts"), "utf8");
    expect(source).toContain("claimAppReload");
    expect(source).toContain("replaceCurrentDocument");
    expect(source).not.toContain("clearWorkboxPrecaches");
    expect(source).not.toContain("caches.delete");
    expect(source).not.toContain("location.reload");
  });
});

describe("refreshAppToLatest", () => {
  it("オフラインでは再読み込みしない", async () => {
    const claimReload = vi.fn();
    const reload = vi.fn();
    const result = await refreshAppToLatest({
      online: false,
      claimReload,
      updateRegistrations: async () => undefined,
      waitForActivated: async () => undefined,
      reload,
    });
    expect(result).toBe("offline");
    expect(claimReload).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("記録を先に書いてから update し、precache 削除なしで replace する", async () => {
    const order: string[] = [];
    const result = await refreshAppToLatest({
      online: true,
      claimReload: (reason) => {
        order.push(`claim:${reason}`);
        return "reload";
      },
      updateRegistrations: async () => {
        order.push("update");
      },
      waitForActivated: async () => {
        order.push("ready");
      },
      reload: () => {
        order.push("replace");
      },
    });
    expect(result).toBe("reload");
    expect(order).toEqual(["claim:user", "update", "ready", "replace"]);
  });
});
