import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

const drinkJpeg = join(dirname(fileURLToPath(import.meta.url)), "fixtures/drink.jpg");
const walkthroughDir = process.env.WALKTHROUGH_DIR;

test.use({
  video: walkthroughDir ? "on" : "off",
});

async function shot(page: Page, name: string): Promise<void> {
  if (!walkthroughDir) {
    return;
  }
  await page.screenshot({ path: `${walkthroughDir}/${name}.png`, fullPage: true });
}

function jpegCopies(count: number): string[] {
  const dir = `/tmp/batch-e2e-${count}`;
  mkdirSync(dir, { recursive: true });
  return Array.from({ length: count }, (_, index) => {
    const dest = join(dir, `p${String(index + 1).padStart(2, "0")}.jpg`);
    copyFileSync(drinkJpeg, dest);
    return dest;
  });
}

async function openBatch(page: Page): Promise<void> {
  await signUpAsNewUser(page);
  await mainNav(page).getByRole("button", { name: "セラー" }).click();
  await page.getByRole("button", { name: "まとめて追加" }).click();
  await expect(page.getByText("撮った写真がここに並びます")).toBeVisible();
  await expect(page.getByRole("button", { name: "撮る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ライブラリから（複数枚）" })).toBeVisible();
}

test("ライブラリ 6 枚は欠落せず、進捗が出て完了行だけ保存できる", async ({ page }) => {
  await openBatch(page);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "ライブラリから（複数枚）" }).click();
  await (await chooserPromise).setFiles(jpegCopies(6));

  await expect(page.locator(".bottle-batch-row")).toHaveCount(6);
  await expect(page.getByText(/6枚中/)).toBeVisible();
  await expect(page.getByRole("button", { name: "+ 裏面" })).toHaveCount(6);
  await page.locator(".bottle-batch-progress").scrollIntoViewIfNeeded();
  await shot(page, "cellar_batch_six_rows_progress");

  const names = page.getByLabel("品名");
  await expect(names).toHaveCount(6);
  await names.nth(0).fill("バッチ保存赤");

  const arrange = page.getByRole("button", { name: /棚に並べる（\d+ 本）/ });
  await expect(arrange).toBeEnabled({ timeout: 90_000 });
  await expect(arrange).toHaveText(/棚に並べる（[1-6] 本）/);
  await shot(page, "cellar_batch_six_ready_to_save");
  await arrange.click();

  await expect(page.getByText("バッチ保存赤")).toHaveCount(0);
  await expect(page.locator(".bottle-batch-row")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "まとめて追加" })).toBeVisible();
  await shot(page, "cellar_batch_leftover_rows");
});

test("21 枚は上限を説明し 20 行を超えない", async ({ page }) => {
  await openBatch(page);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "ライブラリから（複数枚）" }).click();
  await (await chooserPromise).setFiles(jpegCopies(21));

  await expect(page.locator(".bottle-batch-row")).toHaveCount(20);
  await expect(page.getByText("20枚を受け付けました。1枚は上限のため追加できません")).toBeVisible();
  await expect(page.getByText(/20枚中/)).toBeVisible();
  await expect(page.getByText("一度に 20 本までです")).toBeVisible();
  await page
    .getByText("20枚を受け付けました。1枚は上限のため追加できません")
    .scrollIntoViewIfNeeded();
  await shot(page, "cellar_batch_overflow_twenty");
});
