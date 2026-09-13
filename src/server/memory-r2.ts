import type { PhotoBucket } from "./services/photos.ts";

type StoredObject = {
  bytes: Uint8Array;
  contentType?: string;
};

export function createMemoryR2(): PhotoBucket & {
  keys(): string[];
  failDelete(key?: string): void;
  clearDeleteFailures(): void;
} {
  const store = new Map<string, StoredObject>();
  const failKeys = new Set<string>();
  let failAll = false;

  return {
    async put(key, value, options) {
      store.set(key, {
        bytes: value.slice(),
        contentType: options?.httpMetadata?.contentType,
      });
    },
    async get(key) {
      const item = store.get(key);
      if (!item) {
        return null;
      }
      const copy = item.bytes.slice();
      return {
        arrayBuffer: async () =>
          copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
        contentType: item.contentType,
      };
    },
    async list(prefix) {
      return {
        objects: [...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
      };
    },
    async delete(key) {
      if (failAll || failKeys.has(key)) {
        throw new Error("timeout");
      }
      store.delete(key);
    },
    keys() {
      return [...store.keys()];
    },
    failDelete(key) {
      if (key) {
        failKeys.add(key);
        return;
      }
      failAll = true;
    },
    clearDeleteFailures() {
      failKeys.clear();
      failAll = false;
    },
  };
}
