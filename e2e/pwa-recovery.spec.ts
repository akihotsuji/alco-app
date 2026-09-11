import { expect, test } from "@playwright/test";
import { signUpAsNewUser } from "./helpers/auth.ts";

async function waitForActiveSw(page: import("@playwright/test").Page) {
  await page.waitForFunction(async () => {
    const ready = await navigator.serviceWorker.ready;
    const worker = ready.active;
    if (!worker) {
      return false;
    }
    if (worker.state === "activated") {
      return true;
    }
    await new Promise<void>((resolve) => {
      worker.addEventListener("statechange", () => resolve(), { once: true });
    });
    return (await navigator.serviceWorker.ready).active?.state === "activated";
  });
  return page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      active: ready.active?.state ?? null,
      controller: Boolean(navigator.serviceWorker.controller),
    };
  });
}

test("初回起動と再読み込みで空画面にならない", async ({ page, request }) => {
  const missing = await request.get("/assets/does-not-exist-OLDHASH.js", {
    headers: {
      Accept: "*/*",
      "Sec-Fetch-Dest": "script",
      "Sec-Fetch-Mode": "cors",
    },
  });
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"] ?? "").not.toContain("text/html");

  const swSource = await request.get("/sw.js");
  const swText = await swSource.text();
  expect(swText).not.toContain("isPwaNetworkOnlyPath");
  expect(swText).toContain("/api/");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
  const first = await waitForActiveSw(page);
  expect(first.active).toBe("activated");

  await page.reload();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  const again = await waitForActiveSw(page);
  expect(again.active).toBe("activated");
  expect(again.controller).toBe(true);
});

test("認証 GET の遅延では読み込み中のままログアウトしない", async ({ page }) => {
  await page.route("**/api/auth/get-session", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 1_500);
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    });
  });
  const pending = page.goto("/");
  await expect(page.getByText("読み込み中")).toBeVisible();
  await pending;
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("認証 GET の失敗は再試行でき、ログインへ自動遷移しない", async ({ page }) => {
  await page.route("**/api/auth/get-session", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("読み込めませんでした");
  await expect(page.getByRole("button", { name: "再試行" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ログイン" })).toHaveCount(0);

  await page.unroute("**/api/auth/get-session");
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    }),
  );
  await page.getByRole("button", { name: "再試行" }).click();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("セッション切れはログインへ戻す", async ({ page }) => {
  await signUpAsNewUser(page);
  // SW 制御下では page.route が get-session を掴めないことがある。Cookie 消失が期限切れ相当
  await page.context().clearCookies();
  await page.reload();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("オフライン再起動で空画面にならない", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await waitForActiveSw(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(/読み込めませんでした|読み込み中|ログイン|読み込みに時間がかかっています/),
  ).toBeVisible();
  const html = await page.locator("#root").innerHTML();
  expect(html.length).toBeGreaterThan(0);
});

test("遅延 JS の失敗で復旧 UI が出る", async ({ page }) => {
  await page.route("**/assets/LoginPage-*.js", (route) =>
    route.fulfill({
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: "Not found",
    }),
  );
  await page.goto("/login");
  await expect(page.getByText("読み込めませんでした")).toBeVisible();
  await expect(page.getByRole("button", { name: "再試行" })).toBeVisible();
});

test("未保存フォームがあるときの更新通知で入力が消えない", async ({ page }) => {
  await signUpAsNewUser(page);
  await page.goto("/logs/new");
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  const name = page.getByRole("textbox", { name: /品名/ });
  await name.fill("更新中の下書き");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("alco-sw-update-available"));
  });
  await expect(page.getByText("新しいバージョンがあります")).toBeVisible();
  await expect(name).toHaveValue("更新中の下書き");
  await page.getByRole("button", { name: "更新" }).click();
  await expect(page.getByRole("heading", { name: "入力を破棄しますか" })).toBeVisible();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(name).toHaveValue("更新中の下書き");
});

test("長いフォームは .app-content でスクロールし、document lock でも止まらない", async ({
  page,
}) => {
  await signUpAsNewUser(page);
  // 記録フォームは Pixel 7 の PWA ビルドでビューポートとほぼ同高になり、overflow が 0 になる。
  // ボトル追加の詳細を開けば .app-content が確実に伸びる。スクロール量は実測 overflow に合わせる。
  await page.goto("/cellar/new");
  await expect(page.getByRole("heading", { name: "ボトルを追加" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /品名/ })).toBeVisible();
  await page.getByRole("button", { name: "詳細" }).click();
  await page.waitForFunction(() => {
    const content = document.querySelector(".app-content");
    const doc = document.scrollingElement;
    if (!content || !doc) {
      return false;
    }
    return (
      content.scrollHeight > content.clientHeight + 8 && doc.scrollHeight - doc.clientHeight <= 8
    );
  });

  const before = await page.evaluate(() => {
    const content = document.querySelector(".app-content");
    const doc = document.scrollingElement;
    return {
      contentScroll: content?.scrollHeight ?? 0,
      contentClient: content?.clientHeight ?? 0,
      docScroll: doc?.scrollHeight ?? 0,
      docClient: doc?.clientHeight ?? 0,
    };
  });
  const overflow = before.contentScroll - before.contentClient;
  expect(overflow).toBeGreaterThan(8);
  expect(before.docScroll - before.docClient).toBeLessThanOrEqual(8);

  const firstScroll = Math.min(220, overflow - 1);
  const secondScroll = Math.min(overflow - 1, firstScroll + Math.min(80, overflow - firstScroll));

  const moved = await page.evaluate((top) => {
    const content = document.querySelector(".app-content");
    if (!content) {
      return false;
    }
    content.scrollTop = top;
    return content.scrollTop >= top;
  }, firstScroll);
  expect(moved).toBe(true);

  const locked = await page.evaluate((top) => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const content = document.querySelector(".app-content");
    if (!content) {
      return false;
    }
    content.scrollTop = top;
    return content.scrollTop >= top;
  }, secondScroll);
  expect(locked).toBe(true);

  await page.mouse.wheel(0, 400);
  const afterWheel = await page.evaluate(() => {
    return document.querySelector(".app-content")?.scrollTop ?? 0;
  });
  expect(afterWheel).toBeGreaterThan(0);

  await page.getByRole("textbox", { name: /品名/ }).fill("スクロール後の入力");
  await expect(page.getByRole("textbox", { name: /品名/ })).toHaveValue("スクロール後の入力");
});
