import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

test.use({ colorScheme: "dark" });

test("OSダーク×アプリライトでも設定ラベルと作成画面の入力が見える", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await page.getByRole("button", { name: "ライト" }).click();

  const displayName = page.getByRole("button", { name: /表示名/ });
  await expect(displayName).toBeVisible();
  await expect(page.getByText("メール")).toBeVisible();
  await expect(page.getByText("写真にキャラを入れる（既定）")).toBeVisible();

  const colors = await displayName.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(colors.color).not.toBe(colors.background);
  expect(colors.color).not.toBe("rgb(230, 224, 214)");

  const walkthroughDir = process.env.WALKTHROUGH_DIR;
  if (walkthroughDir) {
    await page.locator(".app-content").evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(displayName).toBeInViewport();
    await page.screenshot({
      path: `${walkthroughDir}/settings_os_dark_app_light.png`,
      fullPage: false,
    });
  }

  await mainNav(page).getByRole("button", { name: "ノート" }).click();
  await page.getByRole("link", { name: "ノートを作成" }).click();

  const variety = page.getByLabel("品種");
  await variety.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await expect(variety).toBeVisible();
  const box = await variety.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  const save = page.getByRole("button", { name: "ノートを保存" });
  await expect(save).toBeVisible();
  const saveColor = await save.evaluate((el) => getComputedStyle(el).color);
  expect(saveColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(saveColor).not.toBe("rgb(230, 224, 214)");

  const saveBox = await save.boundingBox();
  expect(box && saveBox).toBeTruthy();
  if (box && saveBox) {
    expect(box.y + box.height).toBeLessThan(saveBox.y);
  }

  if (walkthroughDir) {
    await page.screenshot({
      path: `${walkthroughDir}/note_new_variety_centered.png`,
      fullPage: false,
    });
  }
});
