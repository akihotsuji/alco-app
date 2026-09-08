import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const BOTTLE_NAME = "E2Eスモークボトル";

test("ボトルを登録してからノートを作成し、詳細がボトルを指す", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "セラー" }).click();
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await page.getByRole("link", { name: "ボトルを追加" }).click();

  await page.getByLabel("品名").fill(BOTTLE_NAME);
  const arrange = page.getByRole("button", { name: "棚に並べる（1 本）" });
  await expect(arrange).toBeEnabled();
  await arrange.click();

  await expect(page.getByRole("heading", { name: BOTTLE_NAME })).toBeVisible();
  await expect(page.getByText(BOTTLE_NAME).first()).toBeVisible();

  await mainNav(page).getByRole("button", { name: "ノート" }).click();
  await expect(page.getByText("テイスティングノートはまだありません")).toBeVisible();
  await page.getByRole("link", { name: "ノートを作成" }).click();

  await page.getByRole("button", { name: "セラーのボトルと関連付ける（任意）" }).click();
  await expect(page.getByRole("heading", { name: "ボトル" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(BOTTLE_NAME) }).click();

  await expect(page.locator("#note-drink-name")).toHaveValue(BOTTLE_NAME);
  await page.getByRole("button", { name: "評価 4" }).click();

  const save = page.getByRole("button", { name: "ノートを保存" });
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByRole("heading", { name: BOTTLE_NAME })).toBeVisible();
  await expect(page.getByText("セラーのボトル")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(BOTTLE_NAME) })).toBeVisible();
});
