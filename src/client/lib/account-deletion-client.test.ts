import { afterEach, describe, expect, it } from "vitest";
import { ACCOUNT_DELETION_PENDING_USER_KEY } from "@/shared/account-deletion.ts";
import {
  CELLAR_PREF_KEYS,
  GUIDE_PREF_KEY,
  PHOTO_CUTOUT_DIAG_KEY,
  UI_PREF_KEYS,
} from "@/shared/constants.ts";
import { discardAccountScopedClientData } from "./account-deletion-client.ts";
import { JOIN_TOKEN_STORAGE_KEY } from "./cellar-share.ts";

const store = new Map<string, string>();
const sessionStore = new Map<string, string>();

function stubStorage(target: "localStorage" | "sessionStorage", map: Map<string, string>) {
  Object.defineProperty(globalThis, target, {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
      key: (index: number) => [...map.keys()][index] ?? null,
      get length() {
        return map.size;
      },
    },
  });
}

afterEach(() => {
  store.clear();
  sessionStore.clear();
});

describe("discardAccountScopedClientData", () => {
  it("アカウント紐づきだけ捨て、テーマは残す", () => {
    stubStorage("localStorage", store);
    stubStorage("sessionStorage", sessionStore);
    store.set(GUIDE_PREF_KEY, JSON.stringify({ userId: "u1", status: "completed" }));
    store.set(UI_PREF_KEYS.theme, "dark");
    store.set(CELLAR_PREF_KEYS.selectedId, "cellar-1");
    sessionStore.set(PHOTO_CUTOUT_DIAG_KEY, "{}");
    sessionStore.set("opened.followup.b1", "pending");
    sessionStore.set("cellar.shelfEvent", "{}");
    sessionStore.set(ACCOUNT_DELETION_PENDING_USER_KEY, "u1");
    sessionStore.set(JOIN_TOKEN_STORAGE_KEY, "token-value");
    sessionStore.set("cellar.revision.abc", "3");

    discardAccountScopedClientData();

    expect(store.has(GUIDE_PREF_KEY)).toBe(false);
    expect(store.has(CELLAR_PREF_KEYS.selectedId)).toBe(false);
    expect(store.get(UI_PREF_KEYS.theme)).toBe("dark");
    expect(sessionStore.has(PHOTO_CUTOUT_DIAG_KEY)).toBe(false);
    expect(sessionStore.has("opened.followup.b1")).toBe(false);
    expect(sessionStore.has("cellar.shelfEvent")).toBe(false);
    expect(sessionStore.has(ACCOUNT_DELETION_PENDING_USER_KEY)).toBe(false);
    expect(sessionStore.has(JOIN_TOKEN_STORAGE_KEY)).toBe(false);
    expect(sessionStore.has("cellar.revision.abc")).toBe(false);
  });
});
