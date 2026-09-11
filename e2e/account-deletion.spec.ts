import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

test("設定からアカウント削除を受け付け、受付画面へ進む", async ({ page }) => {
  const user = await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  const deleteLink = page.getByRole("link", { name: "アカウントを削除" });
  await expect(deleteLink).toBeVisible();
  await deleteLink.click();

  await expect(page.getByRole("heading", { name: "アカウントを削除" })).toBeVisible();
  await expect(
    page.getByText("飲酒記録、セラーのボトル、テイスティングノート、マイドリンク"),
  ).toBeVisible();
  const submit = page.getByRole("button", { name: "アカウントとデータを削除" });
  await expect(submit).toBeDisabled();

  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await page.getByRole("link", { name: "アカウントを削除" }).click();

  await page.getByLabel("データを復元できないことを確認しました").check();
  await page.getByLabel("パスワード").fill("wrong-password");
  await submit.click();
  await expect(page.getByText("本人確認が必要です")).toBeVisible();
  await expect(page.getByRole("heading", { name: "アカウントを削除" })).toBeVisible();

  await page.getByLabel("パスワード").fill(user.password);
  await submit.click();
  await expect(page.getByRole("heading", { name: "アカウント削除を受け付けました" })).toBeVisible();
  await expect(page.getByText("全データの削除が完了しました")).toHaveCount(0);
  await page.getByRole("link", { name: "ログインへ" }).click();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});
