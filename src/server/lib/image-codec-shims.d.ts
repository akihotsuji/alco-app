declare module "@jsquash/webp/codec/dec/webp_dec.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "jpeg-js" {
  export function decode(
    data: ArrayBuffer | Uint8Array,
    options?: { useTArray?: boolean },
  ): { width: number; height: number; data: Uint8Array };
  export function encode(
    image: { width: number; height: number; data: Uint8Array },
    quality?: number,
  ): { data: Uint8Array };
}
