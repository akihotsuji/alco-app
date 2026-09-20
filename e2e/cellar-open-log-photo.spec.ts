import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { signUpAsNewUser } from "./helpers/auth.ts";

const drinkJpeg = join(dirname(fileURLToPath(import.meta.url)), "fixtures/drink.jpg");
const walkthroughDir = process.env.WALKTHROUGH_DIR;
const BOTTLE_NAME = "E2E抜栓写真ボトル";

test.use({
  video: walkthroughDir ? "on" : "off",
});

async function shot(page: Page, name: string): Promise<void> {
  if (!walkthroughDir) {
    return;
  }
  await page.screenshot({ path: `${walkthroughDir}/${name}.png`, fullPage: false });
}

async function createBottleWithPhoto(page: Page, name: string): Promise<string> {
  const created = await page.request.post("/api/bottles", {
    data: { name, drinkType: "wine_red", count: 1 },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const body = (await created.json()) as { items: { id: string }[] };
  const bottleId = body.items[0]?.id;
  expect(bottleId).toBeTruthy();
  const photo = await page.request.post("/api/photos", {
    multipart: {
      file: {
        name: "drink.jpg",
        mimeType: "image/jpeg",
        buffer: readFileSync(drinkJpeg),
      },
      bottleId,
      sortOrder: "0",
    },
  });
  expect(photo.ok(), await photo.text()).toBeTruthy();
  return bottleId ?? "";
}

test("開栓から飲酒記録を付けると一覧と詳細にボトル写真が残る", async ({ page }) => {
  await signUpAsNewUser(page);
  const bottleId = await createBottleWithPhoto(page, BOTTLE_NAME);

  await page.goto(`/cellar/${bottleId}`);
  await expect(page.getByRole("heading", { name: BOTTLE_NAME })).toBeVisible();
  await expect(page.getByRole("button", { name: "写真を拡大" })).toBeVisible();
  await shot(page, "cellar_bottle_with_photo_before_uncork");

  await page.getByRole("button", { name: "開栓する" }).click();
  await expect(page.getByRole("heading", { name: "開栓しました" })).toBeVisible();
  await page.getByRole("button", { name: "飲んだ量を記録" }).click();

  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await expect(page.getByText(`対象：${BOTTLE_NAME}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "写真を拡大" })).toBeVisible();
  await shot(page, "log_new_inherited_bottle_photo");

  const save = page.getByRole("button", { name: "記録を保存" });
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByText(`${BOTTLE_NAME} 125ml`)).toBeVisible();
  const listThumb = page.getByRole("button", { name: "写真を拡大" });
  await expect(listThumb).toBeVisible();
  await expect(page.locator(".log-row-icon")).toHaveCount(0);
  await expect(page.locator(".log-row-thumb")).toBeVisible();
  await expect(page.locator(".log-row")).toHaveCSS("opacity", "1");
  await expect(page.locator(".log-row.is-highlight")).toHaveCount(0);
  await shot(page, "log_day_row_shows_bottle_photo");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const listed = await page.request.get(`/api/drink-logs?date=${today}`);
  expect(listed.ok(), await listed.text()).toBeTruthy();
  const listBody = (await listed.json()) as {
    items: { id: string; thumbPhotoId: string | null }[];
  };
  expect(listBody.items[0]?.thumbPhotoId).toBeTruthy();

  const thumbRes = await page.request.get(
    `/api/photos/${listBody.items[0]?.thumbPhotoId}/content?variant=thumb`,
  );
  expect(thumbRes.ok()).toBeTruthy();
  expect(thumbRes.headers()["content-type"]).toMatch(/image\//);

  await page.getByRole("link", { name: new RegExp(BOTTLE_NAME) }).click();
  await expect(page.getByRole("heading", { name: "記録を編集" })).toBeVisible();
  await expect(page.getByRole("button", { name: "写真を拡大" })).toBeVisible();
  const detail = await page.request.get(`/api/drink-logs/${listBody.items[0]?.id}`);
  expect(detail.ok()).toBeTruthy();
  const detailBody = (await detail.json()) as {
    thumbPhotoId: string | null;
    photos: { id: string }[];
  };
  expect(detailBody.thumbPhotoId).toBe(listBody.items[0]?.thumbPhotoId);
  expect(detailBody.photos).toHaveLength(1);
  await shot(page, "log_edit_photo_after_uncork_save");
});
