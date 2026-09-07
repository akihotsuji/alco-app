declare module "onnxruntime-web" {
  export class Tensor {
    constructor(type: "float32", data: Float32Array, dims: readonly number[]);
    readonly data: Float32Array | Uint8Array | Int32Array | BigInt64Array;
  }

  export interface InferenceSession {
    readonly inputNames: readonly string[];
    readonly outputNames: readonly string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  }

  export namespace InferenceSession {
    function create(source: ArrayBuffer | Uint8Array | string): Promise<InferenceSession>;
  }

  export const env: {
    wasm: {
      wasmPaths: string;
      numThreads: number;
      simd: boolean;
      proxy: boolean;
    };
  };
}

declare module "onnxruntime-web/wasm" {
  export * from "onnxruntime-web";
}
