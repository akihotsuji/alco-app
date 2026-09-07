import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("onnxruntime-web 1.21.0 の配布物", () => {
  const bundle = readFileSync("node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs", "utf8");

  it("WASM 用 JS は内蔵せず ort-wasm-simd-threaded.mjs を dynamic import する", () => {
    expect(bundle).toContain("ort-wasm-simd-threaded.mjs");
    expect(bundle).toContain("await import(");
    expect(bundle).toMatch(/embeddedWasmModule=false|zt=void 0/);
  });
});
