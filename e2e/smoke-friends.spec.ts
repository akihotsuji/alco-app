import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

test("友達タブが空状態で、ノートは設定から開ける", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await page.getByRole("link", { name: "アイコン（任意）" }).click();
  await expect(page.getByRole("heading", { name: "アイコン" })).toBeVisible();
  await expect(page.getByText("アイコンは任意です")).toBeVisible();
  await page.getByRole("button", { name: "戻る" }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await page.getByRole("link", { name: "テイスティングノート" }).click();
  await expect(page.getByText("テイスティングノートはまだありません")).toBeVisible();

  await mainNav(page).getByRole("button", { name: "友達" }).click();
  await expect(page.getByRole("heading", { name: "友達の近況" })).toBeVisible();
  await expect(
    page.getByText("友達を追加すると、共有されたお酒の記録がここに表示されます"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "招待リンクを貼る" })).toBeVisible();
  await page.getByRole("link", { name: "友達を招待" }).click();
  await expect(page.getByRole("heading", { name: "招待" })).toBeVisible();
  await expect(
    page.getByText("同じリンクをコピーするか、QR を見せてください。有効期限は 7 日です。"),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "招待QR" })).toBeVisible();
});
