import { expect, test } from "@playwright/test";
import { mainNav, signUpAsNewUser } from "./helpers/auth.ts";
import { boxesOverlap } from "./helpers/geometry.ts";

test("中央タブ「飲酒を記録」は 1 行で隣タブと重ならない", async ({ page }) => {
  await signUpAsNewUser(page);
  await mainNav(page).getByRole("button", { name: "セラー" }).click();

  const label = mainNav(page).locator(".tab-center-label");
  await expect(label).toHaveText("飲酒を記録");

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await label.evaluate((el) => {
      const style = getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight);
      const fontSize = parseFloat(style.fontSize);
      return {
        whiteSpace: style.whiteSpace,
        height: el.getBoundingClientRect().height,
        lineHeight: Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.2,
      };
    });
    expect(metrics.whiteSpace, `${width}px`).toBe("nowrap");
    expect(metrics.height, `${width}px`).toBeLessThan(metrics.lineHeight * 1.6);

    const centerBox = await label.boundingBox();
    const cellarBox = await mainNav(page)
      .getByRole("button", { name: "セラー" })
      .locator(".tab-label")
      .boundingBox();
    const notesBox = await mainNav(page)
      .getByRole("button", { name: "ノート" })
      .locator(".tab-label")
      .boundingBox();
    expect(centerBox, `${width}px center`).toBeTruthy();
    expect(cellarBox, `${width}px cellar`).toBeTruthy();
    expect(notesBox, `${width}px notes`).toBeTruthy();
    if (centerBox && cellarBox && notesBox) {
      expect(boxesOverlap(centerBox, cellarBox), `${width}px vs セラー`).toBe(false);
      expect(boxesOverlap(centerBox, notesBox), `${width}px vs ノート`).toBe(false);
    }
  }
});
