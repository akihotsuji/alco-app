import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

test("動きを減らすをタップしても下半分がタブに覆われない", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();

  const always = page.getByRole("radio", { name: "常に減らす" });
  const system = page.getByRole("radio", { name: "端末の設定に従う" });
  const guide = page.getByRole("button", { name: "使い方を見る" });
  const logout = page.getByRole("button", { name: "ログアウト" });
  const tabBar = page.locator(".tab-bar");

  await always.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await expect(always).toBeVisible();
  await expect(guide).toBeVisible();
  await expect(logout).toBeVisible();

  const tabHeightBefore = await tabBar.evaluate((el) => el.getBoundingClientRect().height);

  await always.click();
  await expect(always).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");

  await expect(guide).toBeVisible();
  await expect(logout).toBeVisible();

  const afterAlways = await page.evaluate(() => {
    const tab = document.querySelector(".tab-bar");
    const guideEl = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === "使い方を見る",
    );
    const logoutEl = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === "ログアウト",
    );
    const tabBox = tab?.getBoundingClientRect();
    const guideBox = guideEl?.getBoundingClientRect();
    const logoutBox = logoutEl?.getBoundingClientRect();
    const focused = document.activeElement;
    return {
      tabHeight: tabBox?.height ?? 0,
      guideBottom: guideBox?.bottom ?? 0,
      logoutBottom: logoutBox?.bottom ?? 0,
      tabTop: tabBox?.top ?? 0,
      focusedName: focused instanceof HTMLInputElement ? focused.name : "",
    };
  });

  expect(afterAlways.focusedName).not.toBe("reduce-motion");
  expect(afterAlways.tabHeight).toBeLessThan(140);
  expect(afterAlways.tabHeight).toBeLessThanOrEqual(tabHeightBefore + 8);
  expect(afterAlways.guideBottom).toBeGreaterThan(0);
  expect(afterAlways.guideBottom).toBeLessThanOrEqual(afterAlways.tabTop + 1);
  expect(afterAlways.logoutBottom).toBeLessThanOrEqual(afterAlways.tabTop + 1);

  const walkthroughDir = process.env.WALKTHROUGH_DIR;
  if (walkthroughDir) {
    await page.screenshot({
      path: `${walkthroughDir}/settings-reduce-motion-always.png`,
      fullPage: false,
    });
  }

  await system.click();
  await expect(system).toBeChecked();
  await expect(guide).toBeVisible();
  await expect(logout).toBeVisible();
  const focusedName = await page.evaluate(() =>
    document.activeElement instanceof HTMLInputElement ? document.activeElement.name : "",
  );
  expect(focusedName).not.toBe("reduce-motion");

  if (walkthroughDir) {
    await page.screenshot({
      path: `${walkthroughDir}/settings-reduce-motion-system.png`,
      fullPage: false,
    });
  }
});
