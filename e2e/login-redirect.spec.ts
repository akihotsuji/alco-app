import { expect, type Page, test } from "@playwright/test";
import { type E2EUser, signUpAsNewUser } from "./helpers/auth.ts";

async function logInFromLoginPage(page: Page, user: E2EUser): Promise<void> {
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await page.getByLabel("メール").fill(user.email);
  await page.getByLabel("パスワード", { exact: true }).fill(user.password);
  // 起動時に先読みした 401 を使い回すと /api/me を取り直さずにサインアウトされる
  const meAfterLogin = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/me" && response.status() === 200,
  );
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await meAfterLogin;
}

test.describe("未ログインで開いた URL へログイン後に戻る", () => {
  test("記録入力（PWA ショートカットの飛び先）を開いてログインすると記録入力に着き、ログインが続く", async ({
    page,
    context,
  }) => {
    const user = await signUpAsNewUser(page);
    await context.clearCookies();

    await page.goto("/logs/new");
    await expect(page).toHaveURL(/\/login\?redirect=%2Flogs%2Fnew$/);
    await logInFromLoginPage(page, user);

    await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
    await expect(page.getByRole("button", { name: "記録を保存" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/logs/new");
    await expect(page.getByRole("heading", { name: "ログイン" })).toHaveCount(0);
  });

  test("ホームを開いてログインすると、ホームのままサインアウトされない", async ({
    page,
    context,
  }) => {
    const user = await signUpAsNewUser(page);
    await context.clearCookies();

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await logInFromLoginPage(page, user);

    await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("heading", { name: "ログイン" })).toHaveCount(0);
  });
});
