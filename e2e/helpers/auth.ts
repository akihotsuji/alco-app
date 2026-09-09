import { randomBytes, randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export type E2EUser = {
  name: string;
  email: string;
  password: string;
};

export function createE2EUser(): E2EUser {
  return {
    name: "E2E",
    email: `e2e.${Date.now()}.${randomUUID().slice(0, 8)}@example.com`,
    password: `E2e-${randomBytes(16).toString("hex")}`,
  };
}

export async function dismissFirstRunGuide(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "今はしない" });
  try {
    await skip.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    return;
  }
  await skip.click();
  await expect(page.getByRole("heading", { name: "使い方を少し試してみますか？" })).toHaveCount(0);
}

export async function signUpAsNewUser(
  page: Page,
  user: E2EUser = createE2EUser(),
): Promise<E2EUser> {
  await page.goto("/signup");
  await page.getByLabel("表示名").fill(user.name);
  await page.getByLabel("メール").fill(user.email);
  await page.getByRole("textbox", { name: /パスワード/ }).fill(user.password);
  await page.getByLabel("利用規約とプライバシーポリシーに同意する").check();
  await page.getByRole("button", { name: "登録する" }).click();
  // SPA 遷移では waitForURL(load) が終わらずテスト全体の制限に達することがある
  await expect(page.getByRole("heading", { name: "年齢確認" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("生年月日").fill("1990-01-15");
  await page.getByRole("button", { name: "確認する" }).click();
  // 招待ダイアログが開くと背面の「ホーム」見出しは a11y ツリーから外れる
  await dismissFirstRunGuide(page);
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
  return user;
}

export function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "メイン" });
}
