import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "../../../e2e/helpers/auth.ts";
import { DEMO_BOTTLES, DEMO_LOGS, DEMO_NOTES } from "./demo-catalog.ts";

const promoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(promoRoot, "public/fixtures");
const shotsDir = path.join(promoRoot, "public/shots");

async function waitForVisualReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) => {
        if (image.complete && image.naturalWidth > 0) {
          return undefined;
        }
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function shot(page: Page, name: string): Promise<void> {
  await waitForVisualReady(page);
  await page.screenshot({
    path: path.join(shotsDir, `${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
}

async function setLightTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("ui.theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
  });
}

async function pickLibraryPhoto(page: Page, fileName: string, expectEdit: boolean): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "写真を選ぶ" }).click();
  await (await chooserPromise).setFiles(path.join(fixturesDir, fileName));
  if (!expectEdit) {
    return;
  }
  const dialog = page.getByRole("dialog", { name: "写真を編集" });
  await expect(dialog).toBeVisible();
  const cutout = dialog.getByRole("button", { name: /切り抜く/ });
  if ((await cutout.getAttribute("aria-pressed")) === "true") {
    await cutout.click();
  }
  if (fileName === DEMO_BOTTLES[0]?.photo) {
    await waitForVisualReady(page);
    await page.screenshot({
      path: path.join(shotsDir, "photo-edit-cellar.png"),
      fullPage: false,
      animations: "disabled",
    });
  }
  await dialog.getByRole("button", { name: "使う" }).click();
  await expect(dialog).toHaveCount(0);
}

async function selectDrinkType(page: Page, label: string): Promise<void> {
  const current = page.locator("button.form-select-row").first();
  if ((await current.count()) > 0) {
    await current.click();
    await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
    return;
  }
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function addBottle(page: Page, bottle: (typeof DEMO_BOTTLES)[number], captureForm: boolean) {
  await page.goto("/cellar/new");
  await expect(page.getByRole("heading", { name: "ボトルを追加" })).toBeVisible();
  await pickLibraryPhoto(page, bottle.photo, true);
  await page.locator("#bottle-name").fill(bottle.name);
  await page.getByRole("button", { name: bottle.drinkTypeLabel, exact: true }).click();
  if (bottle.vintage) {
    await page.locator("#bottle-vintage").fill(bottle.vintage);
  }
  if (bottle.variety) {
    await page.locator("#bottle-variety").fill(bottle.variety);
  }
  await page.locator("#bottle-producer").fill(bottle.producer);
  await page.locator("#bottle-origin").fill(bottle.origin);
  await expect(page.getByText("アップロード中")).toHaveCount(0, { timeout: 30_000 });
  if (captureForm) {
    await shot(page, "cellar-new");
  }
  const arrange = page.getByRole("button", { name: /棚に並べる/ });
  await expect(arrange).toBeEnabled();
  await arrange.click();
  await expect(page.getByRole("heading", { name: bottle.name })).toBeVisible({ timeout: 30_000 });
}

async function addLog(page: Page, log: (typeof DEMO_LOGS)[number], captureForm: boolean) {
  await mainNav(page).getByRole("button", { name: "お酒を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  await pickLibraryPhoto(page, log.photo, false);
  await page.locator("#log-drink-name").fill(log.name);
  await selectDrinkType(page, log.drinkTypeLabel);
  await page.getByPlaceholder("店名など").fill(log.place);
  await expect(page.getByText("アップロード中")).toHaveCount(0, { timeout: 30_000 });
  if (captureForm) {
    await shot(page, "log-new");
  }
  const save = page.getByRole("button", { name: "記録を保存" });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("heading", { name: "テイスティングノートをつける？" })).toBeVisible();
  await page.getByRole("button", { name: "あとで" }).click();
}

async function addNote(page: Page, note: (typeof DEMO_NOTES)[number], captureForm: boolean) {
  await page.goto("/notes/new");
  await expect(page.getByRole("heading", { name: "ノートを作成" })).toBeVisible();
  await pickLibraryPhoto(page, note.photo, false);
  await page.locator("#note-drink-name").fill(note.name);
  await selectDrinkType(page, note.drinkTypeLabel);
  await page.getByRole("button", { name: "セラーのボトルと関連付ける（任意）" }).click();
  await expect(page.getByRole("heading", { name: "ボトル" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(note.name) }).click();
  await page.getByRole("radio", { name: `評価 ${note.ratingStar}` }).click();
  if (note.halfStar) {
    await page.getByRole("radio", { name: `評価 ${note.ratingStar}` }).click();
  }
  await page.getByPlaceholder("短い感想").fill(note.taste);
  await expect(page.getByText("アップロード中")).toHaveCount(0, { timeout: 30_000 });
  if (captureForm) {
    await shot(page, "note-new");
  }
  const save = page.getByRole("button", { name: "ノートを保存" });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("heading", { name: note.name })).toBeVisible({ timeout: 30_000 });
}

test("デモデータを投入して紹介用スクリーンショットを撮る", async ({ page }) => {
  await mkdir(shotsDir, { recursive: true });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await shot(page, "login");

  await signUpAsNewUser(page);
  await setLightTheme(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();

  for (const [index, bottle] of DEMO_BOTTLES.entries()) {
    await addBottle(page, bottle, index === 0);
    if (index === 0) {
      await shot(page, "bottle-detail");
    }
  }

  await page.goto("/cellar");
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await expect(page.getByText("北窓ヴィンヤード ピノ・ノワール")).toBeVisible();
  const typeView = page.getByRole("button", { name: "1 本ずつ" });
  if ((await typeView.getAttribute("aria-pressed")) === "false") {
    await typeView.click();
  }
  await shot(page, "cellar");
  const typeToggle = page.getByRole("button", { name: "種類ごと" });
  if ((await typeToggle.count()) > 0) {
    await typeToggle.click();
    await shot(page, "cellar-by-type");
    await page.getByRole("button", { name: "1 本ずつ" }).click();
  }

  for (const [index, log] of DEMO_LOGS.entries()) {
    await addLog(page, log, index === 0);
  }

  await page.goto("/logs");
  await expect(page.getByText("北窓ヴィンヤード ピノ・ノワール")).toBeVisible();
  await shot(page, "log-day");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
  await expect(page.getByRole("link", { name: /今日の記録/ })).toBeVisible();
  await shot(page, "home");

  for (const [index, note] of DEMO_NOTES.entries()) {
    await addNote(page, note, index === 0);
    if (index === 0) {
      await shot(page, "note-detail");
    }
  }

  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "ノート" })).toBeVisible();
  await expect(page.getByText("北窓ヴィンヤード ピノ・ノワール")).toBeVisible();
  await shot(page, "notes");
});
