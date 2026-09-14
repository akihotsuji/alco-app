declare module "onnxruntime-web" {
  export class Tensor {
    constructor(type: "float32", data: Float32Array, dims: readonly number[]);
    readonly data: Float32Array | Uint8Array | Int32Array | BigInt64Array;
    getData?: () => Promise<Float32Array | Uint8Array | Int32Array | BigInt64Array>;
    dispose?: () => void;
  }

  export type InferenceSessionCreateOptions = {
    executionProviders?: readonly string[];
  };

  export interface InferenceSession {
    readonly inputNames: readonly string[];
    readonly outputNames: readonly string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
    release?: () => Promise<void>;
  }

  export namespace InferenceSession {
    function create(
      source: ArrayBuffer | Uint8Array | string,
      options?: InferenceSessionCreateOptions,
    ): Promise<InferenceSession>;
  }

  export const env: {
    wasm: {
      wasmPaths: string | { wasm?: string; mjs?: string };
      numThreads: number;
      simd: boolean;
      proxy: boolean;
    };
    webgpu?: {
      device?: {
        lost?: Promise<unknown>;
      };
    };
  };
}

declare module "onnxruntime-web/wasm" {
  export * from "onnxruntime-web";
}

declare module "onnxruntime-web/webgpu" {
  export * from "onnxruntime-web";
}
