import { decodeBase64Url } from "@/shared/base64url.ts";
import {
  PUSH_PROMPT_DISMISSED_KEY,
  PUSH_UI_COPY,
  type PushSubscriptionBody,
} from "@/shared/web-push.ts";

/**
 * 端末のプッシュ購読（spec/features/web-push.md 4 章）。Notification / PushManager はここからだけ触る。
 * 許可は `enablePushOnDevice` の最初の await でだけ求める（iOS はユーザー操作の中でしか出せない）。
 */

export type PushSupport = "supported" | "ios-needs-install" | "unsupported";
export type PushPermission = "default" | "granted" | "denied";

export type DevicePushSubscription = {
  endpoint: string;
  options?: { applicationServerKey?: ArrayBuffer | null } | null;
  toJSON(): PushSubscriptionJSON;
  unsubscribe(): Promise<boolean>;
};

type DevicePushManager = {
  getSubscription(): Promise<DevicePushSubscription | null>;
  subscribe(options: {
    userVisibleOnly: boolean;
    applicationServerKey: BufferSource;
  }): Promise<DevicePushSubscription>;
};

export type PushBrowser = {
  notification?: {
    permission: string;
    requestPermission(): Promise<string>;
  };
  hasPushManager: boolean;
  ready?: () => Promise<{ pushManager: DevicePushManager }>;
  userAgent: string;
  maxTouchPoints: number;
};

export type PushApi = {
  save(body: PushSubscriptionBody): Promise<void>;
  remove(endpoint: string): Promise<void>;
};

export const PUSH_READY_TIMEOUT_MS = 3000;

export function currentPushBrowser(): PushBrowser {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { hasPushManager: false, userAgent: "", maxTouchPoints: 0 };
  }
  const container = "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
  return {
    notification: "Notification" in window ? window.Notification : undefined,
    hasPushManager: "PushManager" in window,
    ready: container ? () => container.ready : undefined,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

function isAppleMobile(browser: PushBrowser): boolean {
  return (
    /iPhone|iPad|iPod/.test(browser.userAgent) ||
    (/Macintosh/.test(browser.userAgent) && browser.maxTouchPoints > 1)
  );
}

export function detectPushSupport(browser: PushBrowser = currentPushBrowser()): PushSupport {
  if (browser.notification && browser.hasPushManager && browser.ready) {
    return "supported";
  }
  return isAppleMobile(browser) ? "ios-needs-install" : "unsupported";
}

export function readPushPermission(browser: PushBrowser = currentPushBrowser()): PushPermission {
  const value = browser.notification?.permission;
  return value === "granted" || value === "denied" ? value : "default";
}

async function readyManager(browser: PushBrowser): Promise<DevicePushManager | null> {
  if (!browser.ready) {
    return null;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PUSH_READY_TIMEOUT_MS);
  });
  try {
    const registration = await Promise.race([browser.ready(), timeout]);
    return registration?.pushManager ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getDevicePushSubscription(
  browser: PushBrowser = currentPushBrowser(),
): Promise<DevicePushSubscription | null> {
  if (detectPushSupport(browser) !== "supported") {
    return null;
  }
  const manager = await readyManager(browser);
  try {
    return (await manager?.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

function sameServerKey(subscription: DevicePushSubscription, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) {
    return true;
  }
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((value, index) => value === key[index]);
}

export function toSubscriptionBody(
  subscription: DevicePushSubscription,
): PushSubscriptionBody | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    return null;
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh, auth },
  };
}

async function subscribeWithKey(
  manager: DevicePushManager,
  existing: DevicePushSubscription | null,
  key: Uint8Array<ArrayBuffer>,
): Promise<DevicePushSubscription> {
  if (existing && sameServerKey(existing, key)) {
    return existing;
  }
  if (existing) {
    await existing.unsubscribe().catch(() => false);
  }
  return manager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

async function saveOrThrow(api: PushApi, subscription: DevicePushSubscription): Promise<void> {
  const body = toSubscriptionBody(subscription);
  if (!body) {
    throw new Error("incomplete push subscription");
  }
  await api.save(body);
}

export type EnablePushResult = "enabled" | "denied" | "dismissed" | "unsupported" | "failed";

/** 利用者の操作（クリック）から同期的に呼ぶ。最初の await が許可の要求 */
export async function enablePushOnDevice(input: {
  publicKey: string;
  api: PushApi;
  browser?: PushBrowser;
}): Promise<EnablePushResult> {
  const browser = input.browser ?? currentPushBrowser();
  const key = decodeBase64Url(input.publicKey);
  if (detectPushSupport(browser) !== "supported" || !browser.notification || !key) {
    return "unsupported";
  }
  let permission: string;
  try {
    permission = await browser.notification.requestPermission();
  } catch {
    return "failed";
  }
  if (permission === "denied") {
    return "denied";
  }
  if (permission !== "granted") {
    return "dismissed";
  }
  const manager = await readyManager(browser);
  if (!manager) {
    return "failed";
  }
  let subscription: DevicePushSubscription | null = null;
  try {
    subscription = await subscribeWithKey(manager, await manager.getSubscription(), key);
    await saveOrThrow(input.api, subscription);
    return "enabled";
  } catch {
    // サーバーに保存できない購読を端末に残さない
    await subscription?.unsubscribe().catch(() => false);
    return "failed";
  }
}

/** サーバー削除が失敗しても端末の購読は解除する */
export async function disablePushOnDevice(input: {
  api: PushApi;
  browser?: PushBrowser;
}): Promise<"disabled" | "failed"> {
  const subscription = await getDevicePushSubscription(input.browser);
  if (!subscription) {
    return "disabled";
  }
  await input.api.remove(subscription.endpoint).catch(() => undefined);
  try {
    await subscription.unsubscribe();
    return "disabled";
  } catch {
    return "failed";
  }
}

/** 起動時。許可済みで購読がある端末だけ保存し直す。許可は求めない */
export async function resyncPushSubscription(input: {
  publicKey: string;
  api: PushApi;
  browser?: PushBrowser;
}): Promise<"synced" | "skipped" | "failed"> {
  const browser = input.browser ?? currentPushBrowser();
  const key = decodeBase64Url(input.publicKey);
  if (detectPushSupport(browser) !== "supported" || readPushPermission(browser) !== "granted") {
    return "skipped";
  }
  const manager = await readyManager(browser);
  const existing = await manager?.getSubscription().catch(() => null);
  if (!manager || !existing || !key) {
    return "skipped";
  }
  try {
    await saveOrThrow(input.api, await subscribeWithKey(manager, existing, key));
    return "synced";
  } catch {
    return "failed";
  }
}

/** ログアウト・アカウント削除。サーバー行はセッション / ユーザーの CASCADE で消える */
export async function clearDevicePushSubscription(
  browser: PushBrowser = currentPushBrowser(),
): Promise<void> {
  const subscription = await getDevicePushSubscription(browser);
  await subscription?.unsubscribe().catch(() => false);
}

export type PushRowState = {
  support: PushSupport;
  configLoaded: boolean;
  available: boolean;
  permission: PushPermission;
  failed: boolean;
};

/** 設定 S23 の副文（spec/screen-designs/06-settings.md の表の順） */
export function pushSettingsCaption(state: PushRowState): string {
  if (state.support === "ios-needs-install") {
    return PUSH_UI_COPY.iosNeedsInstall;
  }
  if (state.support === "unsupported") {
    return PUSH_UI_COPY.unsupported;
  }
  if (state.configLoaded && !state.available) {
    return PUSH_UI_COPY.unavailable;
  }
  if (state.permission === "denied") {
    return PUSH_UI_COPY.denied;
  }
  if (state.failed) {
    return PUSH_UI_COPY.failed;
  }
  return PUSH_UI_COPY.settingsCaption;
}

export function isPushSwitchDisabled(
  state: PushRowState & { busy: boolean; subscribed: boolean | null },
): boolean {
  return (
    state.support !== "supported" ||
    !state.available ||
    state.permission === "denied" ||
    state.busy ||
    state.subscribed === null
  );
}

/** 通知画面 N1。一度きり（閉じた・許可・拒否で dismissed） */
export function shouldShowPushPrompt(state: {
  support: PushSupport;
  available: boolean;
  permission: PushPermission;
  subscribed: boolean | null;
  dismissed: boolean;
}): boolean {
  return (
    state.support === "supported" &&
    state.available &&
    state.permission === "default" &&
    state.subscribed === false &&
    !state.dismissed
  );
}

export function isPushPromptDismissed(): boolean {
  try {
    return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissPushPrompt(): void {
  try {
    localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
  } catch {
    // 保存できない端末では、この画面を開いている間だけ閉じる
  }
}
