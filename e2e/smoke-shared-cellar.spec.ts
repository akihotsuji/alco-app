import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";

test("共有セラーを作り、招待リンクで参加できる", async ({ browser, page }) => {
  await signUpAsNewUser(page);

  await mainNav(page).getByRole("button", { name: "セラー" }).click();
  await expect(page.getByRole("heading", { name: "セラー" })).toBeVisible();
  await expect(page.getByRole("button", { name: /自分のセラー/ })).toBeVisible();
  await expect(page.getByText("自分だけ")).toBeVisible();

  await page.getByRole("button", { name: /自分のセラー/ }).click();
  await expect(page.getByRole("heading", { name: "表示するセラー" })).toBeVisible();
  await page.getByRole("button", { name: "セラーを共有する" }).click();

  await expect(page.getByRole("heading", { name: "セラーを共有する" })).toBeVisible();
  await expect(
    page.getByText("このセラーのボトルと写真は、参加した人全員が追加・編集・削除できます"),
  ).toBeVisible();
  await page.getByRole("button", { name: "ふたりのセラー" }).click();
  await page.getByRole("button", { name: "共有セラーを作る" }).click();

  await expect(page.getByText("共有セラーを作りました。招待しなくても使えます。")).toBeVisible();
  await page.getByRole("link", { name: "相手を招待する" }).click();

  await expect(page.getByRole("heading", { name: "招待" })).toBeVisible();
  const inviteResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/cellars/") &&
      response.url().includes("/invitations") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "招待リンクを作る" }).click();
  const created = (await (await inviteResponse).json()) as { url: string };
  expect(created.url).toContain("/join#t=");

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signUpAsNewUser(memberPage);
  await memberPage.goto(created.url);
  await expect(
    memberPage.getByRole("heading", { name: "ふたりのセラー に参加しますか？" }),
  ).toBeVisible();
  await expect(memberPage.getByText("飲酒記録とノートは共有されません")).toBeVisible();
  await memberPage.getByRole("button", { name: "参加する" }).click();

  await expect(memberPage.getByRole("heading", { name: "セラー" })).toBeVisible();
  await expect(memberPage.getByRole("button", { name: /ふたりのセラー/ })).toBeVisible();
  await expect(memberPage.getByText("2人")).toBeVisible();

  await memberPage.getByRole("link", { name: "ボトルを追加" }).click();
  await expect(memberPage.getByText("保存先：ふたりのセラー")).toBeVisible();
  await expect(memberPage.getByText("参加者全員に表示されます")).toBeVisible();

  await memberContext.close();
});
