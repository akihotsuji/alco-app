import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";
import { boxesOverlap } from "./helpers/geometry.ts";

/** beer 350ml / 5%（DRINK_TYPE_PRESETS.beer）の表示値 */
const BEER_ALCOHOL_G = "14.0";
const DRINK_NAME = "E2Eスモークビール";

test("サインアップから記録し、今日と週のサマリー数字が合う", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "お酒を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();

  await page.getByRole("textbox", { name: /品名/ }).fill(DRINK_NAME);
  await page.getByRole("button", { name: "赤ワイン" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ビール" }).click();

  const save = page.getByRole("button", { name: "記録を保存" });
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByRole("heading", { name: "テイスティングノートをつける？" })).toBeVisible();
  await page.getByRole("button", { name: "あとで" }).click();

  await expect(page.getByText(`${DRINK_NAME} 350ml`)).toBeVisible();
  await expect(page.getByText("1 杯 ・", { exact: false })).toBeVisible();
  await expect(page.getByText(`${BEER_ALCOHOL_G} g`)).toBeVisible();

  const toast = page.getByRole("status").filter({ hasText: "記録しました" });
  await expect(toast).toBeVisible();
  const back = page.getByRole("button", { name: "戻る" });
  const homeTab = mainNav(page).getByRole("button", { name: "ホーム" });
  const toastBox = await toast.boundingBox();
  const backBox = await back.boundingBox();
  const homeTabBox = await homeTab.boundingBox();
  expect(toastBox && backBox && homeTabBox).toBeTruthy();
  if (toastBox && backBox && homeTabBox) {
    expect(boxesOverlap(toastBox, backBox)).toBe(false);
    expect(boxesOverlap(toastBox, homeTabBox)).toBe(false);
  }

  await mainNav(page).getByRole("button", { name: "お酒を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await expect(toast).toBeVisible();
  const saveAfterToast = page.getByRole("button", { name: "記録を保存" });
  const toastOnForm = await toast.boundingBox();
  const saveBox = await saveAfterToast.boundingBox();
  expect(toastOnForm && saveBox).toBeTruthy();
  if (toastOnForm && saveBox) {
    expect(boxesOverlap(toastOnForm, saveBox)).toBe(false);
  }
  await toast.getByRole("button", { name: "閉じる" }).click();
  await expect(toast).toHaveCount(0);

  await page.getByRole("button", { name: "戻る" }).click();
  await mainNav(page).getByRole("button", { name: "ホーム" }).click();
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
  await expect(page.getByRole("link", { name: /今日の記録/ })).toContainText("1");
  await expect(page.getByRole("link", { name: /今日の記録/ })).toContainText("純アルコール量");
  await expect(page.getByRole("link", { name: /今日の記録/ })).toContainText(BEER_ALCOHOL_G);
  await expect(page.getByRole("link", { name: /今日の記録/ })).toContainText("記録を見る");

  await page.getByRole("link", { name: "詳しく見る" }).click();
  await expect(page.getByRole("heading", { name: "今週" })).toBeVisible();
  await expect(page.getByText(`${BEER_ALCOHOL_G}`, { exact: false }).first()).toBeVisible();
  await expect(page.locator(".summary-score").first()).toContainText("1");
});
