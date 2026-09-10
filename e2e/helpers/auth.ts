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

/** 年齢確認 A5 は 年 / 月 / 日 の 3 欄（spec/screen-designs/01-auth.md） */
export async function fillBirthOn(page: Page, birthOn: string): Promise<void> {
  const [year, month, day] = birthOn.split("-");
  const group = page.getByRole("group", { name: "生年月日" });
  await group.getByLabel("年").fill(year ?? "");
  await group.getByLabel("月").fill(month ?? "");
  await group.getByLabel("日").fill(day ?? "");
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
  const ageHeading = page.getByRole("heading", { name: "年齢確認" });
  const alert = page.getByRole("alert");
  await expect(ageHeading.or(alert)).toBeVisible({ timeout: 30_000 });
  if (!(await ageHeading.isVisible())) {
    throw new Error(`サインアップ後に年齢確認へ進めない: ${await alert.textContent()}`);
  }
  await fillBirthOn(page, "1990-01-15");
  await page.getByRole("button", { name: "確認する" }).click();
  // 招待ダイアログが開くと背面の「ホーム」見出しは a11y ツリーから外れる
  await dismissFirstRunGuide(page);
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
  return user;
}

export function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "メイン" });
}
