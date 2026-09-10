import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const drinkJpeg = join(dirname(fileURLToPath(import.meta.url)), "fixtures/drink.jpg");

test("酒記録は写真選択後に詳細入力へ直接進み、拡大できる", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "お酒を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await page.getByRole("textbox", { name: /品名/ }).fill("手入力ワイン");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "写真を選ぶ" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(drinkJpeg);

  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "写真を編集" })).toHaveCount(0);
  await expect(page.getByText("色補正")).toHaveCount(0);
  await expect(page.getByText("この写真を使う")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "キャラを入れる" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /品名/ })).toHaveValue("手入力ワイン");

  await expect(page.getByRole("button", { name: "写真を拡大" })).toBeVisible();
  await page.getByRole("button", { name: "写真を拡大" }).click();
  const viewer = page.getByRole("dialog", { name: "写真" });
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "閉じる" }).click();
  await expect(viewer).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /品名/ })).toHaveValue("手入力ワイン");
  await expect(page.getByRole("button", { name: "撮り直す" })).toBeVisible();
  await expect(page.getByRole("button", { name: "削除" })).toBeVisible();

  const walkthroughDir = process.env.WALKTHROUGH_DIR;
  if (walkthroughDir) {
    await page.screenshot({
      path: `${walkthroughDir}/log_new_after_photo_select.png`,
      fullPage: false,
    });
    await page.getByRole("button", { name: "写真を拡大" }).click();
    await expect(page.getByRole("dialog", { name: "写真" })).toBeVisible();
    await page.screenshot({
      path: `${walkthroughDir}/log_new_photo_viewer.png`,
      fullPage: false,
    });
    await page
      .getByRole("dialog", { name: "写真" })
      .getByRole("button", { name: "閉じる" })
      .click();
  }
});

test("設定に色補正は無く、キャラ合成の説明がある", async ({ page }) => {
  await signUpAsNewUser(page);
  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await expect(page.getByText("写真にキャラを入れる（既定）")).toBeVisible();
  await expect(page.getByText("新しい写真に合成します。過去の写真は変えません")).toBeVisible();
  await expect(page.getByText("色補正")).toHaveCount(0);
  await expect(page.getByText("写真を Cloudflare 経由の外部 AI に送ります")).toBeVisible();
  await expect(
    page.getByText("写真からの自動入力では、画像を Cloudflare 経由の外部 AI に送ります"),
  ).toBeVisible();
  await expect(page.getByText("Gemini")).toHaveCount(0);

  const walkthroughDir = process.env.WALKTHROUGH_DIR;
  if (walkthroughDir) {
    await page.locator(".app-content").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({
      path: `${walkthroughDir}/settings_no_color_correction.png`,
      fullPage: false,
    });
  }
});
