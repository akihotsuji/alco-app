import { describe, expect, it, vi } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "@/shared/base64url.ts";
import { PUSH_UI_COPY } from "@/shared/web-push.ts";
import {
  clearDevicePushSubscription,
  type DevicePushSubscription,
  detectPushSupport,
  disablePushOnDevice,
  enablePushOnDevice,
  isPushSwitchDisabled,
  type PushApi,
  type PushBrowser,
  pushSettingsCaption,
  readPushPermission,
  resyncPushSubscription,
  shouldShowPushPrompt,
} from "./web-push.ts";

const PUBLIC_KEY = encodeBase64Url(new Uint8Array([4, ...new Array(64).fill(1)]));
const OTHER_KEY = encodeBase64Url(new Uint8Array([4, ...new Array(64).fill(2)]));
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1";

function fakeSubscription(endpoint: string, serverKey = PUBLIC_KEY): DevicePushSubscription {
  const key = decodeBase64Url(serverKey);
  return {
    endpoint,
    options: { applicationServerKey: key ? key.buffer : null },
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: { p256dh: "p256dh-value", auth: "auth-value" },
    }),
    unsubscribe: vi.fn(async () => true),
  };
}

function fakeBrowser(
  options: {
    permission?: string;
    answer?: string;
    existing?: DevicePushSubscription | null;
    ua?: string;
    push?: boolean;
    readyNever?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const state = { permission: options.permission ?? "default" };
  let current: DevicePushSubscription | null = options.existing ?? null;
  const subscribe = vi.fn(async (init: { applicationServerKey: BufferSource }) => {
    calls.push("subscribe");
    const key = new Uint8Array(init.applicationServerKey as ArrayBuffer);
    current = fakeSubscription("https://fcm.googleapis.com/fcm/send/new", encodeBase64Url(key));
    return current;
  });
  const requestPermission = vi.fn(async () => {
    calls.push("requestPermission");
    state.permission = options.answer ?? "granted";
    return state.permission;
  });
  const browser: PushBrowser = {
    notification:
      options.push === false
        ? undefined
        : {
            get permission() {
              return state.permission;
            },
            requestPermission,
          },
    hasPushManager: options.push !== false,
    ready:
      options.push === false
        ? undefined
        : () => {
            calls.push("ready");
            if (options.readyNever) {
              return new Promise(() => undefined);
            }
            return Promise.resolve({
              pushManager: {
                getSubscription: async () => current,
                subscribe,
              },
            });
          },
    userAgent: options.ua ?? ANDROID_UA,
    maxTouchPoints: 5,
  };
  return { browser, calls, subscribe, requestPermission, current: () => current };
}

function fakeApi(options: { saveFails?: boolean; removeFails?: boolean } = {}) {
  const saved: unknown[] = [];
  const removed: string[] = [];
  const api: PushApi = {
    save: vi.fn(async (body) => {
      if (options.saveFails) {
        throw new Error("save failed");
      }
      saved.push(body);
    }),
    remove: vi.fn(async (endpoint) => {
      if (options.removeFails) {
        throw new Error("remove failed");
      }
      removed.push(endpoint);
    }),
  };
  return { api, saved, removed };
}

describe("対応判定", () => {
  it("Notification・PushManager・SW が揃えば対応。iPhone の Safari タブはホーム画面追加の案内", () => {
    expect(detectPushSupport(fakeBrowser().browser)).toBe("supported");
    expect(detectPushSupport(fakeBrowser({ push: false, ua: IPHONE_UA }).browser)).toBe(
      "ios-needs-install",
    );
    expect(
      detectPushSupport({
        hasPushManager: false,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
        maxTouchPoints: 5,
      }),
    ).toBe("ios-needs-install");
    expect(detectPushSupport(fakeBrowser({ push: false }).browser)).toBe("unsupported");
    expect(readPushPermission(fakeBrowser({ permission: "denied" }).browser)).toBe("denied");
    expect(readPushPermission(fakeBrowser({ push: false }).browser)).toBe("default");
  });
});

describe("enablePushOnDevice", () => {
  it("最初に許可を求め、許可後に購読して保存する", async () => {
    const { browser, calls, subscribe } = fakeBrowser();
    const { api, saved } = fakeApi();
    expect(await enablePushOnDevice({ publicKey: PUBLIC_KEY, api, browser })).toBe("enabled");
    expect(calls[0]).toBe("requestPermission");
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(PUBLIC_KEY),
    });
    expect(saved).toEqual([
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/new",
        expirationTime: null,
        keys: { p256dh: "p256dh-value", auth: "auth-value" },
      },
    ]);
  });

  it("拒否・閉じたときは購読しない", async () => {
    for (const [answer, expected] of [
      ["denied", "denied"],
      ["default", "dismissed"],
    ] as const) {
      const { browser, calls } = fakeBrowser({ answer });
      const { api } = fakeApi();
      expect(await enablePushOnDevice({ publicKey: PUBLIC_KEY, api, browser })).toBe(expected);
      expect(calls).toEqual(["requestPermission"]);
      expect(api.save).not.toHaveBeenCalled();
    }
  });

  it("非対応・鍵なしでは許可を求めない", async () => {
    const unsupported = fakeBrowser({ push: false });
    const { api } = fakeApi();
    expect(
      await enablePushOnDevice({ publicKey: PUBLIC_KEY, api, browser: unsupported.browser }),
    ).toBe("unsupported");
    const supported = fakeBrowser();
    expect(await enablePushOnDevice({ publicKey: "@@", api, browser: supported.browser })).toBe(
      "unsupported",
    );
    expect(supported.requestPermission).not.toHaveBeenCalled();
  });

  it("公開鍵が変わった既存購読は作り直す", async () => {
    const old = fakeSubscription("https://fcm.googleapis.com/fcm/send/old", OTHER_KEY);
    const { browser, subscribe } = fakeBrowser({ permission: "granted", existing: old });
    const { api } = fakeApi();
    expect(await enablePushOnDevice({ publicKey: PUBLIC_KEY, api, browser })).toBe("enabled");
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("保存に失敗したら端末の購読を解除して failed", async () => {
    const { browser, current } = fakeBrowser();
    const { api } = fakeApi({ saveFails: true });
    expect(await enablePushOnDevice({ publicKey: PUBLIC_KEY, api, browser })).toBe("failed");
    expect(current()?.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("SW が準備できない（Vite 開発など）ときは打ち切って failed", async () => {
    vi.useFakeTimers();
    try {
      const { browser } = fakeBrowser({ readyNever: true });
      const { api } = fakeApi();
      const pending = enablePushOnDevice({ publicKey: PUBLIC_KEY, api, browser });
      await vi.advanceTimersByTimeAsync(3100);
      expect(await pending).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("disable / resync / clear", () => {
  it("オフはサーバー削除のあと端末の購読を解除する。サーバーが失敗しても解除する", async () => {
    const sub = fakeSubscription("https://fcm.googleapis.com/fcm/send/x");
    const { browser } = fakeBrowser({ permission: "granted", existing: sub });
    const { api, removed } = fakeApi({ removeFails: false });
    expect(await disablePushOnDevice({ api, browser })).toBe("disabled");
    expect(removed).toEqual([sub.endpoint]);
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);

    const sub2 = fakeSubscription("https://fcm.googleapis.com/fcm/send/y");
    const failing = fakeApi({ removeFails: true });
    expect(
      await disablePushOnDevice({
        api: failing.api,
        browser: fakeBrowser({ existing: sub2 }).browser,
      }),
    ).toBe("disabled");
    expect(sub2.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("起動時の同期は許可済み・購読ありだけ保存し直し、許可を求めない", async () => {
    const { api, saved } = fakeApi();
    const notGranted = fakeBrowser({
      existing: fakeSubscription("https://fcm.googleapis.com/fcm/send/a"),
    });
    expect(
      await resyncPushSubscription({ publicKey: PUBLIC_KEY, api, browser: notGranted.browser }),
    ).toBe("skipped");
    expect(notGranted.requestPermission).not.toHaveBeenCalled();

    const noSub = fakeBrowser({ permission: "granted" });
    expect(
      await resyncPushSubscription({ publicKey: PUBLIC_KEY, api, browser: noSub.browser }),
    ).toBe("skipped");
    expect(noSub.subscribe).not.toHaveBeenCalled();

    const ok = fakeBrowser({
      permission: "granted",
      existing: fakeSubscription("https://fcm.googleapis.com/fcm/send/a"),
    });
    expect(await resyncPushSubscription({ publicKey: PUBLIC_KEY, api, browser: ok.browser })).toBe(
      "synced",
    );
    expect(saved).toHaveLength(1);
    expect(ok.requestPermission).not.toHaveBeenCalled();
  });

  it("ログアウト用の解除は購読が無くても投げない", async () => {
    await expect(clearDevicePushSubscription(fakeBrowser().browser)).resolves.toBeUndefined();
    const sub = fakeSubscription("https://fcm.googleapis.com/fcm/send/z");
    await clearDevicePushSubscription(fakeBrowser({ existing: sub }).browser);
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("画面の状態", () => {
  const base = {
    support: "supported" as const,
    configLoaded: true,
    available: true,
    permission: "default" as const,
    failed: false,
  };

  it("S23 の副文は設計の表の順", () => {
    expect(pushSettingsCaption({ ...base, support: "ios-needs-install" })).toBe(
      PUSH_UI_COPY.iosNeedsInstall,
    );
    expect(pushSettingsCaption({ ...base, support: "unsupported" })).toBe(PUSH_UI_COPY.unsupported);
    expect(pushSettingsCaption({ ...base, available: false })).toBe(PUSH_UI_COPY.unavailable);
    expect(pushSettingsCaption({ ...base, permission: "denied" })).toBe(PUSH_UI_COPY.denied);
    expect(pushSettingsCaption({ ...base, failed: true })).toBe(PUSH_UI_COPY.failed);
    expect(pushSettingsCaption(base)).toBe(PUSH_UI_COPY.settingsCaption);
  });

  it("S23 は拒否・非対応・鍵なし・処理中・状態未確定で押せない", () => {
    const ready = { ...base, busy: false, subscribed: false };
    expect(isPushSwitchDisabled(ready)).toBe(false);
    expect(isPushSwitchDisabled({ ...ready, permission: "denied" })).toBe(true);
    expect(isPushSwitchDisabled({ ...ready, support: "unsupported" })).toBe(true);
    expect(isPushSwitchDisabled({ ...ready, available: false })).toBe(true);
    expect(isPushSwitchDisabled({ ...ready, busy: true })).toBe(true);
    expect(isPushSwitchDisabled({ ...ready, subscribed: null })).toBe(true);
  });

  it("N1 は未許可・未購読・未 dismiss の対応端末だけ", () => {
    const show = {
      support: "supported" as const,
      available: true,
      permission: "default" as const,
      subscribed: false,
      dismissed: false,
    };
    expect(shouldShowPushPrompt(show)).toBe(true);
    expect(shouldShowPushPrompt({ ...show, dismissed: true })).toBe(false);
    expect(shouldShowPushPrompt({ ...show, permission: "granted" })).toBe(false);
    expect(shouldShowPushPrompt({ ...show, permission: "denied" })).toBe(false);
    expect(shouldShowPushPrompt({ ...show, subscribed: true })).toBe(false);
    expect(shouldShowPushPrompt({ ...show, subscribed: null })).toBe(false);
    expect(shouldShowPushPrompt({ ...show, available: false })).toBe(false);
    expect(shouldShowPushPrompt({ ...show, support: "ios-needs-install" })).toBe(false);
  });
});
