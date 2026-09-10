import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const drinkJpeg = join(dirname(fileURLToPath(import.meta.url)), "fixtures/drink.jpg");

test("ノートは写真選択後に photo-edit を挟まずサムネが積まれ、評価はスライダーで星が連動する", async ({
  page,
}) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "ノート" }).click();
  await page.getByRole("link", { name: "ノートを作成" }).click();
  await expect(page.getByRole("heading", { name: "ノートを作成" })).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "写真を選ぶ" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(drinkJpeg);

  await expect(page.getByRole("dialog", { name: "写真を編集" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "使う" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "ノートを作成" })).toBeVisible();
  await expect(page.getByText("1 / 6")).toBeVisible();

  const slider = page.getByRole("slider", { name: "評価（1.0〜5.0、0.5刻み）" });
  await expect(slider).toHaveAttribute("aria-valuetext", "未選択");
  await expect(page.getByRole("radio", { name: "評価 4" })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await slider.focus();
  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.press("ArrowRight");
  }
  await expect(slider).toHaveAttribute("aria-valuetext", "4.5");
  await expect(page.getByRole("radio", { name: "評価 4" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "評価 5" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("4.5", { exact: true })).toBeVisible();

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
