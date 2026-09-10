import { expect, test } from "@playwright/test";
import { OAUTH_ERROR_MESSAGE } from "../src/shared/oauth.ts";

test("ログインとサインアップに Google で続行がある", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await expect(page.getByText("または")).toBeVisible();
  const loginGoogle = page.getByRole("button", { name: "Google で続行" });
  await expect(loginGoogle).toBeEnabled();
  await loginGoogle.click();
  await expect(page.getByRole("alert")).toHaveText(OAUTH_ERROR_MESSAGE);

  await page.goto("/login?error=access_denied&error_description=internal");
  await expect(page.getByRole("alert")).toHaveText(OAUTH_ERROR_MESSAGE);
  expect(page.url()).not.toContain("error=");
  expect(page.url()).not.toContain("error_description");

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "アカウント作成" })).toBeVisible();
  const signupGoogle = page.getByRole("button", { name: "Google で続行" });
  await expect(signupGoogle).toBeDisabled();
  await page.getByLabel("利用規約とプライバシーポリシーに同意する").check();
  await expect(signupGoogle).toBeEnabled();
  await expect(page.getByText("招待コード")).toHaveCount(0);
});
