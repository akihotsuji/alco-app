import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const walkthroughDir = process.env.WALKTHROUGH_DIR;

test.use({
  video: walkthroughDir ? { mode: "on", size: { width: 412, height: 915 } } : "off",
});

test("度数は 0.5 刻み、評価は 0.1 刻みでスライダー左右の ± が増減する", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "飲酒を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();

  const abv = page.locator("#log-abv-percent");
  await expect(abv).toHaveValue("12");
  await page.getByRole("button", { name: "度数を 0.5 増やす" }).click();
  await expect(abv).toHaveValue("12.5");
  await page.getByRole("button", { name: "度数を 0.5 増やす" }).click();
  await expect(abv).toHaveValue("13");
  await page.getByRole("button", { name: "度数を 0.5 減らす" }).click();
  await expect(abv).toHaveValue("12.5");

  if (walkthroughDir) {
    await page.screenshot({
      path: `${walkthroughDir}/abv_stepper_12_5.png`,
      fullPage: false,
    });
  }

  await page.getByRole("button", { name: "戻る" }).click();
  await page.getByRole("button", { name: "破棄する" }).click();
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();

  await mainNav(page).getByRole("button", { name: "飲酒を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await page.getByRole("button", { name: "テイスティングを残す" }).click();

  const slider = page.getByRole("slider", { name: "評価（1.0〜5.0、0.1刻み）" });
  await expect(slider).toHaveAttribute("aria-valuetext", "未選択");
  await expect(page.getByRole("button", { name: "評価を 0.1 下げる" })).toBeVisible();
  await expect(page.getByRole("button", { name: "評価を 0.1 上げる" })).toBeVisible();

  await page.getByRole("button", { name: "評価を 0.1 上げる" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "1.0");
  await page.getByRole("button", { name: "評価を 0.1 上げる" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "1.1");
  await page.getByRole("button", { name: "評価を 0.1 上げる" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "1.2");

  await slider.fill("4.2");
  await expect(slider).toHaveAttribute("aria-valuetext", "4.2");
  await expect(page.getByText("4.2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "評価を 0.1 下げる" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "4.1");
  await expect(page.getByText("4.1", { exact: true })).toBeVisible();
  await expect(page.getByText("0.1 刻みで動かせます")).toBeVisible();

  if (walkthroughDir) {
    await page.locator(".note-rating").screenshot({
      path: `${walkthroughDir}/rating_slider_with_stepper_4_1.png`,
    });
    await page.screenshot({
      path: `${walkthroughDir}/note_new_rating_4_1.png`,
      fullPage: false,
    });
  }
});
