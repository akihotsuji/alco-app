import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { tokenFromInviteUrl } from "../src/client/lib/social-invite.ts";
import { createE2EUser, signUpAsNewUser } from "./helpers/auth.ts";

const VIEWPORT = { width: 390, height: 844 };

function originOf(page: Page): string {
  return new URL(page.url()).origin;
}

async function postJson(page: Page, path: string, data: unknown) {
  const res = await page.request.post(path, {
    headers: { Origin: originOf(page), "Content-Type": "application/json" },
    data,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

test.describe("友達近況の横型リスト", () => {
  test.use({ viewport: VIEWPORT, hasTouch: true });

  test("基準ビューポートで最大構成の4投稿全体が見える", async ({ page, browser }) => {
    const userA = createE2EUser();
    userA.name = "長い表示名ABCDEFG";
    await signUpAsNewUser(page, userA);
    const invitation = (await (await page.request.get("/api/friends/invitations")).json()) as {
      url: string;
    };
    const token = tokenFromInviteUrl(invitation.url);
    expect(token).toBeTruthy();

    const pageB = await browser.newPage();
    await pageB.setViewportSize(VIEWPORT);
    const userB = createE2EUser();
    userB.name = "閲覧者";
    await signUpAsNewUser(pageB, userB);
    const created = (await postJson(pageB, "/api/friends/requests", { token })) as {
      request: { id: string };
    };
    await postJson(page, `/api/friends/requests/${created.request.id}/accept`, {});

    const names = [
      "StormignisPinotNoirVeryLongEnglishName",
      "短い酒",
      "コメント付きの一本",
      "まとめ用1",
    ];
    for (const [index, name] of names.entries()) {
      if (index === 3) {
        const batchId = randomUUID();
        await postJson(page, "/api/bottles", {
          name,
          drinkType: "wine_red",
          registrationBatchId: batchId,
        });
        await postJson(page, "/api/bottles", {
          name: "まとめ用2",
          drinkType: "wine_red",
          registrationBatchId: batchId,
        });
        await postJson(page, "/api/social/shares", {
          operationKey: randomUUID(),
          source: { kind: "cellar_batch", registrationBatchId: batchId },
        });
        continue;
      }
      const log = (await postJson(page, "/api/drink-logs", {
        drinkType: "wine",
        volumeMl: 125,
        abvPercent: 12,
        drinkName: name,
        tastingNote: { ratingX10: 42, taste: "とても長いひとことで一覧では一行に収める" },
      })) as { id: string };
      await postJson(page, "/api/social/shares", {
        operationKey: randomUUID(),
        source: { kind: "drink_log", drinkLogId: log.id },
      });
    }

    await pageB.goto("/friends");
    await expect(pageB.getByRole("heading", { name: "友達の近況" })).toBeVisible();
    const cards = pageB.locator("[data-testid=social-feed-card]");
    await expect(cards).toHaveCount(4);

    const header = pageB.locator(".app-header");
    const center = pageB.locator(".tab-center-btn");
    const headerBox = await header.boundingBox();
    const centerBox = await center.boundingBox();
    expect(headerBox && centerBox).toBeTruthy();
    const usableTop = (headerBox?.y ?? 0) + (headerBox?.height ?? 0);
    const usableBottom = centerBox?.y ?? VIEWPORT.height;
    for (let index = 0; index < 4; index += 1) {
      const box = await cards.nth(index).boundingBox();
      expect(box, `card ${index} missing`).toBeTruthy();
      expect(box?.y ?? 0).toBeGreaterThanOrEqual(usableTop - 1);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(usableBottom + 1);
    }
    await expect(pageB.getByText("＋1本")).toBeVisible();

    const guest = await browser.newContext({
      viewport: VIEWPORT,
      locale: "ja-JP",
      serviceWorkers: "block",
    });
    const guestPage = await guest.newPage();
    await guestPage.goto(`/friends/join#t=${token}`);
    await expect(guestPage.getByRole("link", { name: "ログインして続ける" })).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "招待リンクをコピー" })).toBeVisible();
    await expect(guestPage.getByText("ホーム画面から酒のしおりを開き")).toBeVisible();
    await guest.close();
    await pageB.close();
  });
});
