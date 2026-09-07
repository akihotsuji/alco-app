import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTO_CUTOUT_MODEL_URL } from "@/shared/constants.ts";
import { loadCutoutModelBytes } from "./cutout-model-cache.ts";

vi.mock("@/shared/cutout-model.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/cutout-model.ts")>();
  return {
    ...actual,
    inspectCutoutModelBytes: vi.fn(actual.inspectCutoutModelBytes),
  };
});

const { inspectCutoutModelBytes } = await import("@/shared/cutout-model.ts");

describe("loadCutoutModelBytes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(inspectCutoutModelBytes).mockReset();
    vi.mocked(inspectCutoutModelBytes).mockImplementation(async (source) => {
      const actual = await vi.importActual<typeof import("@/shared/cutout-model.ts")>(
        "@/shared/cutout-model.ts",
      );
      return actual.inspectCutoutModelBytes(source);
    });
  });

  it("モデル URL が HTML を返したらキャッシュせず model_download になる", async () => {
    const put = vi.fn();
    vi.stubGlobal("caches", {
      open: async () => ({
        match: async () => undefined,
        put,
        delete: async () => true,
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<!doctype html><html><body>app</body></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    await expect(loadCutoutModelBytes()).rejects.toMatchObject({
      name: "CutoutError",
      reason: "model_download",
      detail: "invalid model: html",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("不正キャッシュは対象エントリだけ捨ててネットワークから取り直す", async () => {
    const deleted: string[] = [];
    const put = vi.fn();
    vi.mocked(inspectCutoutModelBytes)
      .mockResolvedValueOnce({ ok: false, reason: "html" })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("caches", {
      open: async () => ({
        match: async () => new Response("<html>stale</html>"),
        put,
        delete: async (url: string) => {
          deleted.push(url);
          return true;
        },
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );

    const loaded = await loadCutoutModelBytes();
    expect(new Uint8Array(loaded)).toEqual(Uint8Array.of(1, 2, 3));
    expect(deleted).toEqual([PHOTO_CUTOUT_MODEL_URL]);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("Cache Storage の書き込み失敗では取得済みデータで続ける", async () => {
    vi.mocked(inspectCutoutModelBytes).mockResolvedValue({ ok: true });
    vi.stubGlobal("caches", {
      open: async () => ({
        match: async () => undefined,
        put: async () => {
          throw new Error("quota");
        },
        delete: async () => true,
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([9]), { status: 200 })),
    );

    const loaded = await loadCutoutModelBytes();
    expect(new Uint8Array(loaded)).toEqual(Uint8Array.of(9));
  });

  it("Cache Storage の open 失敗でもネットワーク取得できる", async () => {
    vi.mocked(inspectCutoutModelBytes).mockResolvedValue({ ok: true });
    vi.stubGlobal("caches", {
      open: async () => {
        throw new Error("cache disabled");
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([4]), { status: 200 })),
    );

    await expect(loadCutoutModelBytes()).resolves.toBeInstanceOf(ArrayBuffer);
  });
});
