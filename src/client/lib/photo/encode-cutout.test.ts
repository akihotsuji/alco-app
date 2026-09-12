import { describe, expect, it } from "vitest";
import { CutoutError } from "./cutout-result.ts";
import { encodeCutoutBlob } from "./encode-cutout.ts";

function canvasStub(): HTMLCanvasElement {
  return { width: 80, height: 120 } as HTMLCanvasElement;
}

describe("encodeCutoutBlob", () => {
  it("WebP が取れればそれを使う", async () => {
    const webp = new Blob([new Uint8Array(8)], { type: "image/webp" });
    const blob = await encodeCutoutBlob(canvasStub(), {
      encodeWebp: async () => webp,
      encodePng: async () => {
        throw new Error("png should not run");
      },
    });
    expect(blob).toBe(webp);
  });

  it("iOS のように WebP 要求が PNG を返しても切り抜き済み PNG を使う", async () => {
    const png = new Blob([new Uint8Array(8)], { type: "image/png" });
    const blob = await encodeCutoutBlob(canvasStub(), {
      encodeWebp: async () => png,
      encodePng: async () => {
        throw new Error("already have png");
      },
    });
    expect(blob).toBe(png);
    expect(blob.type).toBe("image/png");
  });

  it("WebP 化に失敗したら PNG を使う", async () => {
    const png = new Blob([new Uint8Array(8)], { type: "image/png" });
    const blob = await encodeCutoutBlob(canvasStub(), {
      encodeWebp: async () => {
        throw new Error("no webp");
      },
      encodePng: async () => png,
    });
    expect(blob).toBe(png);
  });

  it("1MB 超の PNG は縮小して再エンコードする", async () => {
    const huge = new Blob([new Uint8Array(20)], { type: "image/png" });
    const small = new Blob([new Uint8Array(4)], { type: "image/png" });
    let resized = false;
    const blob = await encodeCutoutBlob(canvasStub(), {
      encodeWebp: async () => huge,
      encodePng: async () => (resized ? small : huge),
      resize: (source) => {
        resized = true;
        return source;
      },
      maxBytes: 10,
    });
    expect(resized).toBe(true);
    expect(blob).toBe(small);
  });

  it("切り抜き形式にできなければ encode エラー", async () => {
    await expect(
      encodeCutoutBlob(canvasStub(), {
        encodeWebp: async () => new Blob([new Uint8Array(2)], { type: "image/jpeg" }),
        encodePng: async () => new Blob([new Uint8Array(2)], { type: "image/jpeg" }),
      }),
    ).rejects.toBeInstanceOf(CutoutError);
  });
});
