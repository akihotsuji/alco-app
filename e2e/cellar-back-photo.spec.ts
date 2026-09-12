import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const drinkJpeg = join(dirname(fileURLToPath(import.meta.url)), "fixtures/drink.jpg");
const frontJpeg = process.env.CELLAR_FRONT_JPEG ?? drinkJpeg;
const backJpeg = process.env.CELLAR_BACK_JPEG ?? drinkJpeg;
const walkthroughDir = process.env.WALKTHROUGH_DIR;

const BOTTLE_NAME = "ソーラリス千曲川メルロー-(SOLARIS CHIKUMAGAWA MERLOT)";
const BOTTLE_PRODUCER = "マンズワイン (MANNS WINES)";
const BATCH_NAME = "E2Eまとめて裏面";

test.use({
  video: walkthroughDir ? "on" : "off",
});

async function shot(page: Page, name: string): Promise<void> {
  if (!walkthroughDir) {
    return;
  }
  await page.screenshot({ path: `${walkthroughDir}/${name}.png`, fullPage: false });
}

async function confirmCellarPhotoEdit(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "写真を編集" });
  await expect(dialog).toBeVisible();
  const cutout = dialog.getByRole("button", { name: /切り抜く/ });
  if ((await cutout.getAttribute("aria-pressed")) === "true") {
    await cutout.click();
  }
  await dialog.getByRole("button", { name: "使う" }).click();
  await expect(dialog).toHaveCount(0);
}

async function pickFrontFromLibrary(page: Page, file: string): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "写真を選ぶ" }).click();
  await (await chooserPromise).setFiles(file);
  await confirmCellarPhotoEdit(page);
}

async function expectPropRightAligned(page: Page, label: string): Promise<void> {
  const row = page.locator(".bottle-prop", { has: page.locator("dt", { hasText: label }) });
  await expect(row).toHaveClass(/is-inline/);
  await expect(row.locator("dd")).toHaveCSS("text-align", "right");
}

async function expectBottlePhotos(page: Page, bottleId: string, count: number): Promise<void> {
  const res = await page.request.get(`/api/bottles/${bottleId}`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    photos: { id: string; sortOrder: number }[];
  };
  expect(body.photos).toHaveLength(count);
  if (count >= 1) {
    expect(body.photos[0]?.sortOrder).toBe(0);
  }
  if (count >= 2) {
    expect(body.photos[1]?.sortOrder).toBe(1);
  }
}

test("単体追加で裏面を付けて保存すると詳細に残り、棚には表面だけ出る", async ({ page }) => {
  await signUpAsNewUser(page);
  await mainNav(page).getByRole("button", { name: "セラー" }).click();
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await page.getByRole("link", { name: "ボトルを追加" }).click();
  await expect(page.getByRole("heading", { name: "ボトルを追加" })).toBeVisible();
  await expect(page.getByText("裏面（任意）")).toHaveCount(0);

  await pickFrontFromLibrary(page, frontJpeg);
  await expect(page.getByText("裏面（任意）")).toBeVisible();
  await expect(page.getByRole("button", { name: "裏面を選ぶ" })).toBeVisible();

  const retry = page.getByRole("button", { name: "再読み取り" });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await shot(page, "cellar_new_front_retry");
  await retry.click();
  await expect(page.getByText("ラベルを読み取り中…")).toBeVisible();
  await expect(retry).toHaveCount(0);
  await expect(page.getByRole("button", { name: "再読み取り" })).toBeVisible({ timeout: 30_000 });

  const backChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "裏面を選ぶ" }).click();
  await (await backChooser).setFiles(backJpeg);
  await expect(page.getByRole("dialog", { name: "写真を編集" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "裏面の写真" })).toBeVisible();
  await expect(page.getByText("アップロード中")).toHaveCount(0);
  await expect(page.getByText("ラベルを読み取り中…")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "再読み取り" })).toBeVisible();
  await expect(page.getByRole("button", { name: "裏面も含めて読み取る" })).toHaveCount(0);
  await shot(page, "cellar_new_front_and_back");

  await page.getByLabel("品名").fill(BOTTLE_NAME);
  await page.getByLabel("生産者").fill(BOTTLE_PRODUCER);
  const arrange = page.getByRole("button", { name: "棚に並べる（1 本）" });
  await expect(arrange).toBeEnabled();
  await arrange.click();

  await expect(page.getByRole("heading", { name: BOTTLE_NAME })).toBeVisible();
  await expect(page.getByRole("button", { name: "裏面の写真を拡大" })).toBeVisible();
  await expectPropRightAligned(page, "品名");
  await expectPropRightAligned(page, "生産者");
  await expectPropRightAligned(page, "保管場所");
  const props = page.locator(".bottle-props");
  await props.scrollIntoViewIfNeeded();
  await shot(page, "cellar_detail_props_right_align_scrolled");
  if (walkthroughDir) {
    await props.screenshot({ path: `${walkthroughDir}/cellar_detail_props_block.png` });
  }
  await shot(page, "cellar_detail_with_back_thumb");
  await page.getByRole("button", { name: "裏面の写真を拡大" }).click();
  const viewer = page.getByRole("dialog", { name: "写真" });
  await expect(viewer).toBeVisible();
  await shot(page, "cellar_detail_back_lightbox");
  await viewer.getByRole("button", { name: "閉じる" }).click();

  const bottleId = new URL(page.url()).pathname.split("/").pop();
  expect(bottleId).toBeTruthy();
  await expectBottlePhotos(page, bottleId ?? "", 2);

  await mainNav(page).getByRole("button", { name: "セラー" }).click();
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await expect(page.getByRole("link", { name: BOTTLE_NAME })).toBeVisible();
  await expect(page.getByText("裏面", { exact: true })).toHaveCount(0);
  await shot(page, "cellar_shelf_front_only");
});

test("まとめて追加の行に裏面と再読み取りを付けられる", async ({ page }) => {
  await signUpAsNewUser(page);
  await mainNav(page).getByRole("button", { name: "セラー" }).click();
  await page.getByRole("button", { name: "まとめて追加" }).click();
  await expect(page.getByText("撮った写真がここに並びます")).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "ライブラリから（複数枚）" }).click();
  await (await chooserPromise).setFiles(frontJpeg);

  await expect(page.getByRole("button", { name: "+ 裏面" })).toBeVisible({ timeout: 30_000 });
  const retry = page.getByRole("button", { name: "再読み取り" });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await shot(page, "cellar_batch_retry");
  await retry.click();
  await expect(page.getByText("ラベルを読み取り中…")).toBeVisible();
  await expect(page.getByRole("button", { name: "再読み取り" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "再読み取り" })).toBeVisible({ timeout: 30_000 });

  const backChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "+ 裏面" }).click();
  await (await backChooser).setFiles(backJpeg);
  await expect(page.getByRole("img", { name: "裏面の写真" })).toBeVisible();
  await expect(page.getByRole("button", { name: "裏面を外す" })).toBeVisible();
  await expect(page.getByText("ラベルを読み取り中…")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "再読み取り" })).toBeVisible();
  await shot(page, "cellar_batch_with_back");

  await page.getByLabel("品名").fill(BATCH_NAME);
  const arrange = page.getByRole("button", { name: "棚に並べる（1 本）" });
  await expect(arrange).toBeEnabled();
  await arrange.click();
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await expect(page.getByText(BATCH_NAME)).toBeVisible();

  await page.getByRole("link", { name: BATCH_NAME }).click();
  await expect(page.getByRole("button", { name: "裏面の写真を拡大" })).toBeVisible();
  const bottleId = new URL(page.url()).pathname.split("/").pop();
  await expectBottlePhotos(page, bottleId ?? "", 2);
});
