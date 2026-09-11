import { expect, test } from "@playwright/test";
import {
  GOOGLE_LOGIN_LABEL,
  GOOGLE_SIGN_IN_VISIBLE,
  GOOGLE_SIGNUP_LABEL,
  OAUTH_ERROR_MESSAGE,
} from "../src/shared/oauth.ts";

test("Google 導線はフラグで出し分け、OAuth 失敗のクエリは汎用文にして消す", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  const loginGoogle = page.getByRole("button", { name: GOOGLE_LOGIN_LABEL });
  if (GOOGLE_SIGN_IN_VISIBLE) {
    await expect(page.getByText("または")).toBeVisible();
    await expect(loginGoogle).toBeEnabled();
    await expect(page.getByRole("button", { name: "Google で続行" })).toHaveCount(0);
    await loginGoogle.click();
    await expect(page.getByRole("alert")).toHaveText(OAUTH_ERROR_MESSAGE);
  } else {
    await expect(loginGoogle).toHaveCount(0);
    await expect(page.getByText("または")).toHaveCount(0);
  }

  await page.goto("/login?error=access_denied&error_description=internal");
  await expect(page.getByRole("alert")).toHaveText(OAUTH_ERROR_MESSAGE);
  expect(page.url()).not.toContain("error=");
  expect(page.url()).not.toContain("error_description");

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "アカウント作成" })).toBeVisible();
  const signupGoogle = page.getByRole("button", { name: GOOGLE_SIGNUP_LABEL });
  if (GOOGLE_SIGN_IN_VISIBLE) {
    await expect(signupGoogle).toBeDisabled();
    await expect(page.getByRole("button", { name: "Google で続行" })).toHaveCount(0);
    await page.getByLabel("利用規約とプライバシーポリシーに同意する").check();
    await expect(signupGoogle).toBeEnabled();
  } else {
    await expect(signupGoogle).toHaveCount(0);
    await expect(page.getByText("または")).toHaveCount(0);
  }
  await expect(page.getByText("招待コード")).toHaveCount(0);
});
