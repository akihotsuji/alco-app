import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

test("設定からご意見・ご要望を送り、設定へ戻る", async ({ page }) => {
  await signUpAsNewUser(page);
  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "このアプリ" })).toBeVisible();
  await page.getByRole("link", { name: "ご意見・ご要望" }).click();

  await expect(page.getByRole("heading", { name: "ご意見・ご要望" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "メイン" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "改善案" })).toBeVisible();
  await expect(page.getByRole("button", { name: "不具合" })).toBeVisible();
  await expect(page.getByRole("button", { name: "その他" })).toBeVisible();
  await expect(
    page.getByText(
      "返信をお約束するものではありません。退会後も、どなたからのものか分からない形で改善の参考として残します。",
    ),
  ).toBeVisible();
  const submit = page.getByRole("button", { name: "送信する" });
  await expect(submit).toBeDisabled();

  await page.getByLabel("内容").fill("棚の並びが分かりにくいです");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText("送りました")).toBeVisible();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
});
