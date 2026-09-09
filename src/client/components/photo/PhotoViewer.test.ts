import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "PhotoViewer.tsx"), "utf8");
const bottle = readFileSync(join(here, "../cellar/BottleDetail.tsx"), "utf8");
const day = readFileSync(join(here, "../../pages/logs/LogDayPage.tsx"), "utf8");

describe("PhotoViewer", () => {
  it("閉じる・Escape・履歴戻るとフォーカストラップがある", () => {
    expect(source).toContain('aria-label="閉じる"');
    expect(source).toContain("Escape");
    expect(source).toContain("alcoPhotoViewer");
    expect(source).toContain("useFocusTrap");
    expect(source).toContain("document.body.style.overflow");
    expect(source).toContain("createPortal");
  });

  it("記録の日別とセラー詳細が共通ビューアを使う", () => {
    expect(day).toContain("PhotoViewer");
    expect(day).toContain("写真を拡大");
    expect(bottle).toContain("PhotoViewer");
    expect(bottle).toContain('checkerboard={photo?.kind === "cutout"}');
    expect(bottle).not.toContain("bottle-lightbox");
  });
});
