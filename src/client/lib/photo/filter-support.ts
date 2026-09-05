export function supportsCanvasFilter(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !("filter" in ctx)) {
    return false;
  }
  ctx.filter = "brightness(1.1)";
  return ctx.filter === "brightness(1.1)";
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function supportsWasmSimd(): boolean {
  try {
    return WebAssembly.validate(
      Uint8Array.of(
        0,
        97,
        115,
        109,
        1,
        0,
        0,
        0,
        1,
        5,
        1,
        96,
        0,
        1,
        123,
        3,
        2,
        1,
        0,
        10,
        10,
        1,
        8,
        0,
        65,
        0,
        253,
        15,
        253,
        98,
        11,
      ),
    );
  } catch {
    return false;
  }
}
