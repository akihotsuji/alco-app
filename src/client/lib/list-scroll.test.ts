import { afterEach, describe, expect, it } from "vitest";
import { listScrollKey, readListScroll, writeListScroll } from "./list-scroll.ts";

const memory = new Map<string, string>();
const sessionStorageStub = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
  removeItem(key: string) {
    memory.delete(key);
  },
  clear() {
    memory.clear();
  },
};

describe("listScrollKey", () => {
  it("セラー・貯蔵庫・ノート一覧だけキーを返す", () => {
    expect(listScrollKey("/cellar", "?view=one")).toBe("list-scroll:/cellar?view=one");
    expect(listScrollKey("/cellar/archive", "")).toBe("list-scroll:/cellar/archive");
    expect(listScrollKey("/notes", "?q=赤")).toBe("list-scroll:/notes?q=赤");
    expect(listScrollKey("/cellar/new", "")).toBeNull();
    expect(listScrollKey("/notes/n1", "")).toBeNull();
  });
});

describe("read / write list scroll", () => {
  afterEach(() => {
    memory.clear();
  });

  it("保存した位置を読み戻す", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: sessionStorageStub,
    });
    const key = listScrollKey("/cellar", "?view=list");
    writeListScroll(key, 240.4);
    expect(readListScroll(key)).toBe(240);
  });

  it("不正値と空キーは無視する", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: sessionStorageStub,
    });
    sessionStorageStub.setItem("list-scroll:/cellar", "nope");
    expect(readListScroll("list-scroll:/cellar")).toBeNull();
    writeListScroll(null, 10);
    expect(readListScroll(null)).toBeNull();
  });
});
