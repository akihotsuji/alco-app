import { expect, test } from "@playwright/test";
import { APP_VERSION } from "../src/shared/constants.ts";
import { PWA_NAME } from "../src/shared/pwa.ts";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

test("設定に版表記と最新化があり、押すと設定へ戻る", async ({ page }) => {
  await signUpAsNewUser(page);
  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await expect(page.getByText(new RegExp(`^${PWA_NAME} ${APP_VERSION} \\(`))).toBeVisible();
  const refresh = page.getByRole("button", { name: /最新の状態にする/ });
  await refresh.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await expect(refresh).toBeVisible();
  await refresh.click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await expect(page.getByText(new RegExp(`^${PWA_NAME} ${APP_VERSION} \\(`))).toBeVisible();
  await expect(page.getByRole("button", { name: /最新の状態にする/ })).toBeVisible();
});
