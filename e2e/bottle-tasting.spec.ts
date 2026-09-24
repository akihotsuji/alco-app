import { expect, type Page, test } from "@playwright/test";
import { dismissFirstRunGuide, signUpAsNewUser } from "./helpers/auth.ts";

const BOTTLE_NAME = "味わい検証赤";
const walkthroughDir = process.env.WALKTHROUGH_DIR;

async function shot(page: Page, name: string): Promise<void> {
  if (!walkthroughDir) {
    return;
  }
  await page.screenshot({ path: `${walkthroughDir}/${name}.png`, fullPage: false });
}

async function createBottle(page: Page, name: string): Promise<string> {
  const res = await page.request.post("/api/bottles", {
    data: { name, drinkType: "wine_red", count: 1 },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { items: { id: string }[] };
  const id = body.items[0]?.id;
  expect(id).toBeTruthy();
  return id ?? "";
}

async function saveLog(page: Page): Promise<void> {
  const save = page.getByRole("button", { name: "記録を保存" });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText(`${BOTTLE_NAME} 125ml`).first()).toBeVisible();
}

test("開栓 → 味わい中で 2 日目の記録 → 飲み切りで貯蔵庫へ", async ({ page }) => {
  await signUpAsNewUser(page);
  const bottleId = await createBottle(page, BOTTLE_NAME);
  await createBottle(page, "棚に残る白");

  // 開栓すると詳細に留まり、状態が味わい中になる
  await page.goto(`/cellar/${bottleId}`);
  await dismissFirstRunGuide(page);
  await page.getByRole("button", { name: "開栓する" }).click();
  await expect(page.getByRole("heading", { name: "開栓しました" })).toBeVisible();
  await page.getByRole("button", { name: "今はしない" }).click();
  await expect(page.getByText(/^味わい中（/)).toBeVisible();
  await expect(page.getByRole("button", { name: "飲み切った" })).toBeVisible();
  await expect(page.getByRole("button", { name: "開栓を取り消す" })).toBeVisible();
  await shot(page, "tasting_detail_opened");

  // セラー: 上部の丸アイコンに出て、ヘッダーの本数は未開栓 + 味わい中
  await page.goto("/cellar");
  const strip = page.getByRole("region", { name: /味わい中 1本/ });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("link", { name: BOTTLE_NAME })).toBeVisible();
  await expect(page.getByText("2 本")).toBeVisible();
  await shot(page, "tasting_cellar_strip");

  // ホーム: 今週の下に同じ丸アイコン。タップでボトル詳細
  await page.goto("/");
  const homeStrip = page.getByRole("region", { name: /味わい中 1本/ });
  await expect(homeStrip).toBeVisible();
  await shot(page, "tasting_home_strip");
  await homeStrip.getByRole("link", { name: BOTTLE_NAME }).click();
  await expect(page.getByRole("heading", { name: BOTTLE_NAME })).toBeVisible();

  // 1 日目の記録（飲み切りスイッチは OFF のまま）
  await page.getByRole("link", { name: "飲んだ量を記録" }).click();
  await expect(page.getByRole("heading", { name: "お酒を記録" })).toBeVisible();
  const finishSwitch = page.getByRole("switch", { name: "このボトルを飲み切った" });
  await expect(finishSwitch).toHaveAttribute("aria-checked", "false");
  await saveLog(page);

  // 2 日目の記録で飲み切った
  await page.goto(`/cellar/${bottleId}`);
  await expect(page.getByText(/^味わい中（/)).toBeVisible();
  await expect(page.getByRole("button", { name: "開栓を取り消す" })).toHaveCount(0);
  await page.getByRole("link", { name: "飲んだ量を記録" }).click();
  await page.getByRole("switch", { name: "このボトルを飲み切った" }).click();
  await shot(page, "tasting_log_finish_switch");
  await saveLog(page);

  const after = await page.request.get(`/api/bottles/${bottleId}`);
  expect(after.ok()).toBeTruthy();
  expect(((await after.json()) as { status: string }).status).toBe("consumed");

  // 貯蔵庫に移り、詳細で味わい中に戻せる
  await page.goto("/cellar/archive");
  await expect(page.getByText(BOTTLE_NAME)).toBeVisible();
  await page.getByText(BOTTLE_NAME).click();
  await expect(page.getByText(/^飲み切り（/)).toBeVisible();
  await shot(page, "tasting_archive_detail");
  await page.getByRole("button", { name: "味わい中に戻す" }).click();
  await expect(page.getByText(/^味わい中（/)).toBeVisible();

  await page.goto("/cellar");
  await expect(page.getByRole("region", { name: /味わい中 1本/ })).toBeVisible();
});

test("味わい中の詳細から「飲み切った」→ トーストの取り消しで戻る", async ({ page }) => {
  await signUpAsNewUser(page);
  const bottleId = await createBottle(page, BOTTLE_NAME);
  const open = await page.request.post(`/api/bottles/${bottleId}/open`, { data: {} });
  expect(open.ok(), await open.text()).toBeTruthy();

  await page.goto(`/cellar/${bottleId}`);
  await dismissFirstRunGuide(page);
  await page.getByRole("button", { name: "飲み切った" }).click();
  await expect(page.getByText("飲み切りにしました")).toBeVisible();
  await expect(page.getByText(/^飲み切り（/)).toBeVisible();
  await page.getByRole("button", { name: "取り消す" }).click();
  await expect(page.getByText(/^味わい中（/)).toBeVisible();
});
