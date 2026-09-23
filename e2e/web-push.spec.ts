import { webcrypto } from "node:crypto";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

type PushCalls = { requestPermission: number; subscribe: number; unsubscribe: number };

declare global {
  interface Window {
    __pushCalls?: PushCalls;
  }
}

const SETTINGS_LABEL = "友達のお知らせを通知する";

/** テスト用の VAPID 公開鍵（P-256 の点。秘密鍵は使わない・残さない） */
async function testPublicKey(): Promise<string> {
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", pair.publicKey));
  return Buffer.from(raw).toString("base64url");
}

/**
 * Vite 開発では SW を登録しないため、通知の許可と PushManager を差し替える。
 * 購読と許可の状態は localStorage に置き、再読み込みをまたいで保つ。
 */
async function stubPush(context: BrowserContext, answer: "granted" | "denied") {
  await context.addInitScript((permissionAnswer) => {
    const PERMISSION_KEY = "__e2e.push.permission";
    const SUB_KEY = "__e2e.push.subscription";
    window.__pushCalls = { requestPermission: 0, subscribe: 0, unsubscribe: 0 };
    const calls = window.__pushCalls;

    const toB64 = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");

    type Stored = { endpoint: string; p256dh: string; auth: string };
    const load = (): Stored | null => {
      const raw = localStorage.getItem(SUB_KEY);
      return raw ? (JSON.parse(raw) as Stored) : null;
    };
    const wrap = (stored: Stored) => ({
      endpoint: stored.endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({
        endpoint: stored.endpoint,
        expirationTime: null,
        keys: { p256dh: stored.p256dh, auth: stored.auth },
      }),
      unsubscribe: async () => {
        calls.unsubscribe += 1;
        localStorage.removeItem(SUB_KEY);
        return true;
      },
    });

    const pushManager = {
      getSubscription: async () => {
        const stored = load();
        return stored ? wrap(stored) : null;
      },
      subscribe: async () => {
        calls.subscribe += 1;
        const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
          "deriveBits",
        ]);
        const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
        const stored: Stored = {
          endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${crypto.randomUUID()}`,
          p256dh: toB64(raw),
          auth: toB64(crypto.getRandomValues(new Uint8Array(16))),
        };
        localStorage.setItem(SUB_KEY, JSON.stringify(stored));
        return wrap(stored);
      },
    };

    Object.defineProperty(ServiceWorkerContainer.prototype, "ready", {
      configurable: true,
      get: () => Promise.resolve({ pushManager }),
    });
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => localStorage.getItem(PERMISSION_KEY) ?? "default",
    });
    Object.defineProperty(Notification, "requestPermission", {
      configurable: true,
      value: async () => {
        calls.requestPermission += 1;
        localStorage.setItem(PERMISSION_KEY, permissionAnswer);
        return permissionAnswer;
      },
    });
  }, answer);
}

async function stubPushConfig(page: Page, publicKey: string) {
  await page.route("**/api/push/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ available: true, publicKey }),
    }),
  );
}

async function pushCalls(page: Page): Promise<PushCalls> {
  return page.evaluate(
    () => window.__pushCalls ?? { requestPermission: -1, subscribe: -1, unsubscribe: -1 },
  );
}

async function openSettings(page: Page) {
  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
}

test("起動では許可を求めず、設定の操作で購読・解除し、通知画面の案内は一度きり", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await stubPush(context, "granted");
  const page = await context.newPage();
  await stubPushConfig(page, await testPublicKey());

  try {
    await signUpAsNewUser(page);
    await mainNav(page).getByRole("button", { name: "友達" }).click();
    await page.getByRole("link", { name: "通知" }).click();
    const prompt = page.getByRole("region", { name: "この端末にも通知を届けますか" });
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("名前やお酒の内容は通知に出しません");
    await openSettings(page);
    await expect(page.getByRole("switch", { name: SETTINGS_LABEL })).toBeEnabled();
    expect((await pushCalls(page)).requestPermission).toBe(0);

    // N1「今はしない」は再読み込み後も出ない。許可も求めない
    await page.goto("/friends/notifications");
    await page
      .getByRole("region", { name: "この端末にも通知を届けますか" })
      .getByRole("button", { name: "今はしない" })
      .click();
    await expect(page.getByRole("region", { name: "この端末にも通知を届けますか" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "すべて既読" })).toBeVisible();
    await expect(page.getByRole("region", { name: "この端末にも通知を届けますか" })).toHaveCount(0);
    expect((await pushCalls(page)).requestPermission).toBe(0);

    await openSettings(page);
    const toggle = page.getByRole("switch", { name: SETTINGS_LABEL });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("名前やお酒の内容は通知に出しません")).toBeVisible();

    const saved = page.waitForResponse(
      (res) => res.url().endsWith("/api/push/subscription") && res.request().method() === "PUT",
    );
    await toggle.click();
    expect((await saved).status()).toBe(200);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(await pushCalls(page)).toMatchObject({ requestPermission: 1, subscribe: 1 });

    const removed = page.waitForResponse(
      (res) => res.url().endsWith("/api/push/subscription") && res.request().method() === "DELETE",
    );
    await toggle.click();
    expect((await removed).status()).toBe(200);
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect((await pushCalls(page)).unsubscribe).toBe(1);
  } finally {
    await context.close();
  }
});

test("拒否するとスイッチは無効になり、端末の設定での戻し方を出す", async ({ browser }) => {
  const context = await browser.newContext();
  await stubPush(context, "denied");
  const page = await context.newPage();
  await stubPushConfig(page, await testPublicKey());
  const puts: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/push/subscription") && request.method() === "PUT") {
      puts.push(request.url());
    }
  });

  try {
    await signUpAsNewUser(page);
    await openSettings(page);
    const toggle = page.getByRole("switch", { name: SETTINGS_LABEL });
    await toggle.click();
    await expect(page.getByText("通知がブロックされています")).toBeVisible();
    await expect(toggle).toBeDisabled();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(await pushCalls(page)).toMatchObject({ requestPermission: 1, subscribe: 0 });
    expect(puts).toEqual([]);

    // 拒否後は通知画面の案内も出さない
    await page.goto("/friends/notifications");
    await expect(page.getByRole("button", { name: "すべて既読" })).toBeVisible();
    await expect(page.getByRole("region", { name: "この端末にも通知を届けますか" })).toHaveCount(0);
    expect((await pushCalls(page)).requestPermission).toBe(0);
  } finally {
    await context.close();
  }
});
