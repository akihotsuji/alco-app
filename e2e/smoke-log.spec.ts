import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

/** beer 350ml / 5%（DRINK_TYPE_PRESETS.beer）の表示値 */
const BEER_ALCOHOL_G = "14.0";
const DRINK_NAME = "E2Eスモークビール";

test("サインアップから記録し、今日と週のサマリー数字が合う", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "お酒を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();

  await page.getByLabel("品名").fill(DRINK_NAME);
  await page.getByRole("button", { name: "種類を選択" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ビール" }).click();

  const save = page.getByRole("button", { name: "記録を保存" });
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByRole("heading", { name: "テイスティングノートをつける？" })).toBeVisible();
  await page.getByRole("button", { name: "あとで" }).click();

  await expect(page.getByText(`${DRINK_NAME} 350ml`)).toBeVisible();
  await expect(page.getByText("1 杯 ・", { exact: false })).toBeVisible();
  await expect(page.getByText(`${BEER_ALCOHOL_G} g`)).toBeVisible();

  await mainNav(page).getByRole("button", { name: "ホーム" }).click();
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
  await expect(page.getByText("今日は 1 杯記録しています")).toBeVisible();
  await expect(page.getByRole("link", { name: "今日の記録を見る" })).toContainText(BEER_ALCOHOL_G);

  await page.getByRole("link", { name: "詳しく見る" }).click();
  await expect(page.getByRole("heading", { name: "今週" })).toBeVisible();
  await expect(page.getByText(`${BEER_ALCOHOL_G}`, { exact: false }).first()).toBeVisible();
  await expect(page.locator(".summary-score").first()).toContainText("1");
});
