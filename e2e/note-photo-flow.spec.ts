import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const drinkJpeg = join(dirname(fileURLToPath(import.meta.url)), "fixtures/drink.jpg");

test("記録のテイスティング節は写真選択後に photo-edit を挟まずサムネが積まれ、評価はスライダーで星が連動する", async ({
  page,
}) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "ノート" }).click();
  await page.getByRole("link", { name: "記録する" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await page.getByRole("button", { name: "テイスティングを残す" }).click();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator(".log-tasting-section").getByRole("button", { name: "写真を選ぶ" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(drinkJpeg);

  await expect(page.getByRole("dialog", { name: "写真を編集" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "使う" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await expect(page.getByText("1 / 6")).toBeVisible();

  const slider = page.getByRole("slider", { name: "評価（1.0〜5.0、0.1刻み）" });
  await expect(slider).toHaveAttribute("aria-valuetext", "未選択");
  await expect(page.getByRole("radio", { name: "評価 4" })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await page.getByRole("button", { name: "評価を 0.1 上げる" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "1.0");
  await page.getByRole("button", { name: "評価を 0.1 上げる" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "1.1");

  await slider.fill("4.2");
  await expect(slider).toHaveAttribute("aria-valuetext", "4.2");
  await expect(page.getByRole("radio", { name: "評価 4" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "評価 5" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("4.2", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "評価 3" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "3.0");
  await expect(page.getByRole("radio", { name: "評価 4" })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  const walkthroughDir = process.env.WALKTHROUGH_DIR;
  if (walkthroughDir) {
    await page.screenshot({
      path: `${walkthroughDir}/note_new_after_photo_select_rating_slider.png`,
      fullPage: false,
    });
  }
});
