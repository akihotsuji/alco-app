import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

type BadgeCall = ["set", number | null] | ["clear"];

declare global {
  interface Window {
    __badgeCalls?: BadgeCall[];
  }
}

/** Badging API を記録用に差し替える（実機の OS バッジは Playwright から見えない） */
async function stubBadging(context: BrowserContext) {
  await context.addInitScript(() => {
    window.__badgeCalls = [];
    Object.defineProperty(Navigator.prototype, "setAppBadge", {
      configurable: true,
      value: (contents?: number) => {
        window.__badgeCalls?.push(["set", contents ?? null]);
        return Promise.resolve();
      },
    });
    Object.defineProperty(Navigator.prototype, "clearAppBadge", {
      configurable: true,
      value: () => {
        window.__badgeCalls?.push(["clear"]);
        return Promise.resolve();
      },
    });
  });
}

/** 非対応ブラウザ（iOS Safari のタブ等）相当 */
async function removeBadging(context: BrowserContext) {
  await context.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, "setAppBadge");
    Reflect.deleteProperty(Navigator.prototype, "clearAppBadge");
  });
}

async function badgeCalls(page: Page): Promise<BadgeCall[]> {
  return page.evaluate(() => window.__badgeCalls ?? []);
}

async function lastBadgeCall(page: Page): Promise<BadgeCall | undefined> {
  return (await badgeCalls(page)).at(-1);
}

async function clearCount(page: Page): Promise<number> {
  return (await badgeCalls(page)).filter((call) => call[0] === "clear").length;
}

async function inviteToken(page: Page): Promise<string> {
  const url = await page.evaluate(async () => {
    const res = await fetch("/api/friends/invitations");
    const body = (await res.json()) as { url: string };
    return body.url;
  });
  const token = new URL(url).hash.replace(/^#t=/, "");
  expect(token).not.toBe("");
  return token;
}

test("アイコンのバッジは未読数に追従し、既読とログアウトで消える", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await stubBadging(contextA);
  await removeBadging(contextB);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await signUpAsNewUser(pageA);
    await expect.poll(() => lastBadgeCall(pageA)).toEqual(["clear"]);
    const token = await inviteToken(pageA);

    // B は Badging API の無いブラウザ。登録と申請が通常どおりできる
    await signUpAsNewUser(pageB);
    const status = await pageB.evaluate(async (value) => {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      return res.status;
    }, token);
    expect(status).toBe(201);
    await expect(pageB.getByRole("heading", { name: "ホーム" })).toBeVisible();

    // A が前面に戻ると未読数を取り直してバッジに出す
    await pageA.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => lastBadgeCall(pageA)).toEqual(["set", 1]);

    await mainNav(pageA).getByRole("button", { name: "友達" }).click();
    await pageA.getByRole("link", { name: "通知" }).click();
    await expect(pageA.getByText("さんから友達申請が届きました")).toBeVisible();
    await pageA.getByRole("button", { name: "すべて既読" }).click();
    await expect.poll(() => lastBadgeCall(pageA)).toEqual(["clear"]);

    const clearsBeforeLogout = await clearCount(pageA);
    await mainNav(pageA).getByRole("button", { name: "設定" }).click();
    await pageA.getByRole("button", { name: "ログアウト" }).click();
    await pageA.getByRole("dialog").getByRole("button", { name: "ログアウト" }).click();
    await expect(pageA).toHaveURL(/\/login/);
    expect(await clearCount(pageA)).toBeGreaterThan(clearsBeforeLogout);
    expect(await lastBadgeCall(pageA)).toEqual(["clear"]);
    expect((await badgeCalls(pageA)).some((call) => call[0] === "set" && call[1] === 0)).toBe(
      false,
    );
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
