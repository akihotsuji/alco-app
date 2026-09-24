import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const BOTTLE_NAME = "E2Eスモークボトル";

test("ボトルを登録してから記録でノートを残し、詳細がボトルを指す", async ({ page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "セラー" }).click();
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await page.getByRole("link", { name: "ボトルを追加" }).click();

  await page.getByLabel("品名").fill(BOTTLE_NAME);
  const arrange = page.getByRole("button", { name: "棚に並べる（1 本）" });
  await expect(arrange).toBeEnabled();
  await arrange.click();

  await expect(page.getByRole("heading", { name: "ボトル詳細" })).toBeVisible();
  await expect(page.getByRole("heading", { name: BOTTLE_NAME, level: 2 })).toBeVisible();
  await expect(page.getByText("Googleで調べる")).toBeVisible();
  await expect(page.getByText(BOTTLE_NAME).first()).toBeVisible();

  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await page.getByRole("link", { name: "テイスティングノート" }).click();
  await expect(page.getByText("テイスティングノートはまだありません")).toBeVisible();
  await expect(page.getByText("味や感想は、記録するときに残せます")).toBeVisible();
  await page.getByRole("link", { name: "記録する" }).click();

  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await page.getByRole("button", { name: "セラーのボトルと関連付ける" }).click();
  await expect(page.getByRole("heading", { name: "ボトル" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(BOTTLE_NAME) }).click();
  // 未開栓のボトルで記録すると、保存後に開栓して味わい中になる（bottle-tasting.md N8d）
  await expect(page.getByText("保存すると開栓して味わい中になります")).toBeVisible();

  await page.getByRole("button", { name: "テイスティングを残す" }).click();
  await page.getByRole("radio", { name: "評価 4" }).click();

  const save = page.getByRole("button", { name: "記録を保存" });
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByText(`${BOTTLE_NAME} 125ml`)).toBeVisible();
  await expect(page.getByText("★4.0")).toBeVisible();

  await mainNav(page).getByRole("button", { name: "設定" }).click();
  await page.getByRole("link", { name: "テイスティングノート" }).click();
  await page.getByRole("link", { name: new RegExp(BOTTLE_NAME) }).click();
  await expect(page.getByRole("heading", { name: BOTTLE_NAME, level: 2 })).toBeVisible();
  await expect(page.getByText("Googleで調べる")).toBeVisible();
  await expect(page.getByText("味わい中のボトル")).toBeVisible();
  await expect(page.getByRole("link", { name: /味わい中のボトル/ })).toBeVisible();
});
