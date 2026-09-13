import { describe, expect, it } from "vitest";
import { LEGAL_VERSION } from "./legal.ts";
import { PRIVACY_DOCUMENT, TERMS_DOCUMENT } from "./legal-documents.ts";
import { PROD_CANONICAL_ORIGIN, SERVICE_NAME_JA } from "./prod-canonical.ts";

function allTexts(document: typeof TERMS_DOCUMENT): string[] {
  return document.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.type === "p" ? [block.text] : block.items)),
  );
}

describe("法務文書", () => {
  it("版が現行と一致し、酒類と国外移転を含む", () => {
    expect(TERMS_DOCUMENT.version).toBe(LEGAL_VERSION);
    expect(PRIVACY_DOCUMENT.version).toBe(LEGAL_VERSION);
    const terms = allTexts(TERMS_DOCUMENT).join("\n");
    const privacy = allTexts(PRIVACY_DOCUMENT).join("\n");
    expect(terms).toContain(SERVICE_NAME_JA);
    expect(terms).toContain(PROD_CANONICAL_ORIGIN);
    expect(terms).toContain("満20歳未満");
    expect(terms).toContain("飲酒を推奨しません");
    expect(privacy).toContain("Cloudflare");
    expect(privacy).toContain("生活記録");
    expect(privacy).toContain("生年月日");
    expect(privacy).toContain("Resend");
    expect(privacy).toContain("Google");
    expect(privacy).toContain("Turnstile");
    expect(privacy).toContain("ボット対策");
    expect(privacy).toContain("ご意見・ご要望");
    expect(privacy).toContain("送信者と結びつかない形");
    expect(terms).toContain("Googleアカウント");
    expect(terms).toContain("再設定");
    expect(terms).toContain("年齢確認画面");
    expect(terms).toContain("共有セラー");
    expect(terms).toContain("飲酒記録、テイスティングノート");
    expect(terms).toContain("招待リンク");
    expect(terms).toContain("アカウントの削除");
    expect(terms).toContain("オフにするスイッチはありません");
    expect(terms).not.toContain("もう一杯");
    expect(terms).not.toContain("spec/");
    expect(privacy).toContain("共有セラー");
    expect(privacy).toContain("参加者にも配信");
    expect(privacy).toContain("Google検索");
    expect(privacy).toContain("退会したメンバー");
    expect(privacy).toContain("サービスワーカー");
    expect(privacy).not.toContain("他ユーザーには見せない");
    expect(privacy).not.toContain("<script");
    expect(privacy).not.toContain("spec/");
  });

  it("見出しにセラー共有があり、公開プロフィールを約束しない", () => {
    expect(TERMS_DOCUMENT.sections.some((section) => section.heading === "セラー共有")).toBe(true);
    expect(PRIVACY_DOCUMENT.sections.some((section) => section.heading === "セラー共有")).toBe(
      true,
    );
    const terms = allTexts(TERMS_DOCUMENT).join("\n");
    const privacy = allTexts(PRIVACY_DOCUMENT).join("\n");
    expect(terms).not.toContain("公開プロフィール");
    expect(privacy).toContain("不特定多数への公開には使いません");
  });
});
