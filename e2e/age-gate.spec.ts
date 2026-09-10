import { expect, test } from "@playwright/test";
import { createE2EUser, dismissFirstRunGuide, fillBirthOn } from "./helpers/auth.ts";

test.describe("年齢確認", () => {
  test("サインアップ後は /age。未満は拒否、確認後は redirect 先へ。未確認はタブ配下へ行けない", async ({
    page,
  }) => {
    const user = createE2EUser();
    await page.goto("/signup");
    await page.getByLabel("表示名").fill(user.name);
    await page.getByLabel("メール").fill(user.email);
    await page.getByRole("textbox", { name: /パスワード/ }).fill(user.password);
    await page.getByLabel("利用規約とプライバシーポリシーに同意する").check();
    await page.getByRole("button", { name: "登録する" }).click();

    await expect(page.getByRole("heading", { name: "年齢確認" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("酒類の記録のため、20歳以上の方のみ利用できます。")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "メイン" })).toHaveCount(0);

    await page.goto("/cellar");
    await expect(page.getByRole("heading", { name: "年齢確認" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/age");
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/cellar");

    await fillBirthOn(page, "2016-01-01");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "ご利用いただけません" })).toBeVisible();
    await expect(page.getByText("20歳未満の方は本サービスをご利用いただけません。")).toBeVisible();
    await expect(page.getByRole("button", { name: "生年月日を修正" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
    await expect(page.getByRole("group", { name: "生年月日" })).toHaveCount(0);

    await page.getByRole("button", { name: "生年月日を修正" }).click();
    await expect(page.getByRole("heading", { name: "年齢確認" })).toBeVisible();
    await fillBirthOn(page, "1990-01-15");
    await page.getByRole("button", { name: "確認する" }).click();
    await dismissFirstRunGuide(page);
    await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/cellar");

    await page.goto("/age");
    await dismissFirstRunGuide(page);
    await expect(page.getByRole("heading", { name: "ホーム" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
