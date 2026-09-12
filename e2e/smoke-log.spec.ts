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
  await page.getByPlaceholder("店名など").fill("アフリカー");
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
  await expect(page.getByText("アフリカー")).toBeVisible();
  await expect(page.getByText("その日いた場所")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "アフリカー", exact: true })).toHaveCount(0);

  const toast = page.getByRole("status").filter({ hasText: "記録しました" });
  await expect(toast).toBeVisible();
  const prevDay = page.getByRole("button", { name: "前日" });
  const homeTab = mainNav(page).getByRole("button", { name: "ホーム" });
  const toastBox = await toast.boundingBox();
  const prevDayBox = await prevDay.boundingBox();
  const homeTabBox = await homeTab.boundingBox();
  expect(toastBox && prevDayBox && homeTabBox).toBeTruthy();
  if (toastBox && prevDayBox && homeTabBox) {
    expect(boxesOverlap(toastBox, prevDayBox)).toBe(false);
    expect(boxesOverlap(toastBox, homeTabBox)).toBe(false);
  }

  await page.getByRole("link", { name: new RegExp(DRINK_NAME) }).click();
  await expect(page.getByRole("heading", { name: "記録を編集" })).toBeVisible();
  await expect(page.getByPlaceholder("店名など")).toHaveValue("アフリカー");
  await expect(page.getByRole("link", { name: /この場所を地図で/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByText(`${DRINK_NAME} 350ml`)).toBeVisible();

  await homeTab.click();
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
