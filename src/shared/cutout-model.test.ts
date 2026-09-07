import { describe, expect, it } from "vitest";
import { PHOTO_CUTOUT_MODEL_BYTES, PHOTO_CUTOUT_MODEL_SHA256 } from "./constants.ts";
import { inspectCutoutModelBytes, isHtmlLikeBytes, sha256Hex } from "./cutout-model.ts";

describe("isHtmlLikeBytes", () => {
  it("先頭が < なら HTML とみなす", () => {
    expect(isHtmlLikeBytes(new TextEncoder().encode("<!doctype html>"))).toBe(true);
    expect(isHtmlLikeBytes(new TextEncoder().encode("  \n<html>"))).toBe(true);
  });

  it("ONNX の先頭は HTML ではない", () => {
    expect(isHtmlLikeBytes(Uint8Array.of(0x08, 0x06, 0x12, 0x07))).toBe(false);
  });
});

describe("inspectCutoutModelBytes", () => {
  it("HTML をモデルとして受け入れない", async () => {
    await expect(
      inspectCutoutModelBytes(new TextEncoder().encode("<!doctype html>")),
    ).resolves.toEqual({ ok: false, reason: "html" });
  });

  it("サイズが違うバイト列は拒否する", async () => {
    await expect(inspectCutoutModelBytes(new Uint8Array(16))).resolves.toEqual({
      ok: false,
      reason: "size",
    });
  });

  it("サイズだけ合ってハッシュが違う列は拒否する", async () => {
    await expect(
      inspectCutoutModelBytes(new Uint8Array(PHOTO_CUTOUT_MODEL_BYTES)),
    ).resolves.toEqual({
      ok: false,
      reason: "hash",
    });
  });

  it("sha256Hex は既知の空入力と一致する", async () => {
    expect(await sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(PHOTO_CUTOUT_MODEL_SHA256).toHaveLength(64);
  });
});
