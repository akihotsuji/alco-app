import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { dismissFirstRunGuide, signUpAsNewUser } from "./helpers/auth.ts";

const drinkJpeg = join(dirname(fileURLToPath(import.meta.url)), "fixtures/drink.jpg");
const NAMES = ["追従ア", "追従イ", "追従ウ", "追従エ", "追従オ"] as const;

test.use({
  hasTouch: true,
});

async function createWineBottles(page: Page, names: readonly string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const res = await page.request.post("/api/bottles", {
      data: { name, drinkType: "wine_red", count: 1 },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = (await res.json()) as { items: { id: string }[] };
    const id = body.items[0]?.id;
    expect(id).toBeTruthy();
    ids.push(id ?? "");
  }
  return ids;
}

async function attachPhoto(page: Page, bottleId: string): Promise<void> {
  const res = await page.request.post("/api/photos", {
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
  expect(res.ok(), await res.text()).toBeTruthy();
}

async function openTypeGrid(page: Page): Promise<void> {
  // API で足したボトルは mutation の invalidate を通らない。
  // タブ先読みの空一覧は staleTime 30s のあいだ残るので、フル遷移で取り直す。
  await page.goto("/cellar");
  await dismissFirstRunGuide(page);
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await page.getByRole("button", { name: "種類ごと" }).click();
  await page.getByRole("button", { name: "赤ワイン 5 本を開く" }).click();
  const dialog = page.getByRole("dialog", { name: /赤ワイン/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("長押しして並べ替え")).toBeVisible();
}

async function tileCenter(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await page.getByRole("button", { name }).boundingBox();
  expect(box).toBeTruthy();
  return { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
}

type TouchClient = {
  send: (method: "Input.dispatchTouchEvent", params: Record<string, unknown>) => Promise<unknown>;
};

async function startTouchDrag(
  page: Page,
  from: { x: number; y: number },
  holdMs = 450,
): Promise<TouchClient> {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });
  await page.waitForTimeout(holdMs);
  return client;
}

async function moveTouch(client: TouchClient, point: { x: number; y: number }): Promise<void> {
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: point.x, y: point.y }],
  });
}

async function endTouch(client: TouchClient): Promise<void> {
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

test("種類グリッドはタッチ長押しで指に追従し、ドロップで順が変わる", async ({ page }) => {
  await signUpAsNewUser(page);
  const ids = await createWineBottles(page, NAMES);
  await attachPhoto(page, ids[0] ?? "");
  await attachPhoto(page, ids[1] ?? "");

  await openTypeGrid(page);
  const dialog = page.getByRole("dialog", { name: /赤ワイン/ });
  await expect(dialog.locator("img.bottle-tile-img[data-state='loaded']").first()).toBeVisible({
    timeout: 20_000,
  });

  const namesBefore = await dialog.locator(".type-grid-cell .bottle-tile-name").allTextContents();
  expect(namesBefore).toHaveLength(5);
  const firstName = namesBefore[0] ?? "";
  const lastName = namesBefore[4] ?? "";
  expect(firstName).not.toBe(lastName);

  const from = await tileCenter(page, firstName);
  const within = { x: from.x + 12, y: from.y + 8 };
  const last = await tileCenter(page, lastName);
  const client = await startTouchDrag(page, from);
  await expect(dialog).toHaveAttribute("data-phase", "drag", { timeout: 8_000 });
  await moveTouch(client, within);
  const follow = page.locator(".type-grid-follow");
  await expect(follow.locator(".bottle-tile-name")).toHaveText(firstName);
  const transformInCell = await follow.evaluate((node) => node.style.transform);
  await moveTouch(client, { x: within.x + 10, y: within.y + 6 });
  await expect
    .poll(async () => follow.evaluate((node) => node.style.transform))
    .not.toBe(transformInCell);
  await moveTouch(client, { x: last.x, y: last.y });
  await page.waitForTimeout(80);
  await endTouch(client);
  await expect(dialog).toHaveAttribute("data-phase", "idle", { timeout: 8_000 });
  await expect(page.locator(".type-grid-follow .bottle-tile")).toHaveCount(0);
  await expect(dialog.locator("[aria-live='polite']")).not.toHaveText("移動を取り消しました");

  const namesAfter = await dialog.locator(".type-grid-cell .bottle-tile-name").allTextContents();
  expect(namesAfter).toEqual([...namesBefore.slice(1), firstName]);

  await dialog.getByRole("button", { name: firstName }).click();
  await expect(page.getByRole("heading", { name: firstName })).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "並べ替え" }).click();
  await expect(dialog.getByRole("toolbar", { name: "並べ替え" })).toBeVisible();
  const selectedBefore = await dialog
    .locator(".type-grid-cell[data-selected='1'] .bottle-tile-name")
    .textContent();
  await dialog.getByRole("button", { name: "次へ" }).click();
  const namesMoved = await dialog.locator(".type-grid-cell .bottle-tile-name").allTextContents();
  expect(namesMoved[0]).not.toBe(selectedBefore);
  await dialog.getByRole("button", { name: "決定" }).click();
  await expect(dialog.getByRole("toolbar", { name: "並べ替え" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "完了" }).click();
  await expect(dialog).toHaveCount(0);
});
