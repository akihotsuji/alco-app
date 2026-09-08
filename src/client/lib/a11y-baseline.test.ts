import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APP_HEADER_TITLE_ID } from "./a11y.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const FORMS = [
  "src/client/pages/LoginPage.tsx",
  "src/client/pages/SignupPage.tsx",
  "src/client/components/logs/LogNewForm.tsx",
  "src/client/components/logs/LogEditForm.tsx",
  "src/client/components/logs/VolumeField.tsx",
  "src/client/components/logs/AbvField.tsx",
  "src/client/components/logs/MemoField.tsx",
  "src/client/components/logs/PlaceField.tsx",
  "src/client/components/cellar/BottleForm.tsx",
  "src/client/components/notes/NoteForm.tsx",
  "src/client/pages/logs/MyDrinkPages.tsx",
];

describe("a11y baseline（6-04）", () => {
  it("主要フォームは label / htmlFor / aria-label のいずれかで名前を付ける", () => {
    for (const rel of FORMS) {
      const source = read(rel);
      expect(
        source.includes("htmlFor") || source.includes("aria-label") || source.includes("<Label"),
        rel,
      ).toBe(true);
      expect(source, rel).not.toContain("dangerouslySetInnerHTML");
    }
  });

  it("エラーは aria-invalid とテキスト。挿入行に aria-live は無い", () => {
    expect(read("src/client/components/form/FieldError.tsx")).toContain('role="alert"');
    expect(read("src/client/components/logs/VolumeField.tsx")).toContain("aria-invalid");
    expect(read("src/client/components/logs/AbvField.tsx")).toContain("aria-invalid");
    expect(read("src/client/pages/LoginPage.tsx")).toContain("aria-invalid");
    const day = read("src/client/pages/logs/LogDayPage.tsx");
    expect(day).toContain("useHighlightRow");
    expect(day.slice(day.indexOf("function LogDayRow"))).not.toContain("aria-live");
    const row = read("src/client/hooks/use-highlight-row.ts");
    expect(row).not.toContain("aria-live");
    expect(row).toContain("APP_HEADER_TITLE_ID");
    expect(row).toContain("preventScroll: true");
  });

  it("トーストは role=status。ヘッダー見出しにプログラムフォーカス用 id", () => {
    const toast = read("src/client/components/feedback/ToastProvider.tsx");
    expect(toast).toContain('role="status"');
    expect(toast).toContain('aria-live="polite"');
    const header = read("src/client/components/layout/AppHeader.tsx");
    expect(header).toContain("APP_HEADER_TITLE_ID");
    expect(header).toContain("tabIndex={-1}");
    expect(APP_HEADER_TITLE_ID).toBe("app-header-title");
  });

  it("IconButton は 44px。星は radiogroup。Biome a11y を明示", () => {
    expect(read("src/client/components/ui/button.tsx")).toContain("h-[var(--tap-min)]");
    expect(read("src/client/components/ui/button.tsx")).not.toContain("size-10");
    const stars = read("src/client/components/notes/RatingStars.tsx");
    expect(stars).toContain('role="radiogroup"');
    expect(stars).toContain('role="radio"');
    expect(stars).toContain("aria-checked");
    const biome = read("biome.json");
    expect(biome).toContain('"a11y"');
    expect(biome).toContain('"recommended": true');
    expect(read("src/client/styles.css")).toContain("min-width: var(--tap-min)");
    expect(read("src/client/styles.css")).toContain(".note-star-button");
  });

  it("自作モーダルにフォーカストラップ。photo-edit は設定の reduced motion を見る", () => {
    expect(read("src/client/components/photo/PhotoEdit.tsx")).toContain("useFocusTrap");
    expect(read("src/client/components/photo/PhotoEdit.tsx")).toContain("useReducedMotion");
    expect(read("src/client/components/photo/PhotoEdit.tsx")).not.toContain("prefersReducedMotion");
    expect(read("src/client/components/notes/NotePhotoCarousel.tsx")).toContain("useFocusTrap");
    expect(read("src/client/components/notes/NotePhotoCarousel.tsx")).toContain(
      "aria-label={`写真",
    );
    expect(read("src/client/components/ui/dialog.tsx")).toContain("@radix-ui/react-dialog");
    const reduce = read("src/client/components/settings/ReduceMotionPrefRow.tsx");
    expect(reduce).toContain('type="radio"');
    expect(reduce).toContain('name="reduce-motion"');
  });
});
