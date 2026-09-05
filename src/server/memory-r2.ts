import type { PhotoBucket } from "./services/photos.ts";

type StoredObject = {
  bytes: Uint8Array;
  contentType?: string;
};

export function createMemoryR2(): PhotoBucket & { keys(): string[] } {
  const store = new Map<string, StoredObject>();

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
      };
    },
    async delete(key) {
      store.delete(key);
    },
    keys() {
      return [...store.keys()];
    },
  };
}
