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
    expect(LEGAL_VERSION).toBe("2026-09-22");
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

  it("セラー共有と友達共有を分け、記録の第三者提供をセラーだけに限定しない", () => {
    expect(TERMS_DOCUMENT.sections.some((section) => section.heading === "セラー共有")).toBe(true);
    expect(TERMS_DOCUMENT.sections.some((section) => section.heading === "友達共有")).toBe(true);
    expect(PRIVACY_DOCUMENT.sections.some((section) => section.heading === "セラー共有")).toBe(
      true,
    );
    expect(PRIVACY_DOCUMENT.sections.some((section) => section.heading === "友達共有")).toBe(true);
    const terms = allTexts(TERMS_DOCUMENT).join("\n");
    const privacy = allTexts(PRIVACY_DOCUMENT).join("\n");
    expect(terms).toContain(
      "飲酒記録、テイスティングノート、評価、マイドリンク、位置情報は、共有セラーでは共有しません",
    );
    expect(terms).toContain("相互に承認した相手にだけ近況を見せます");
    expect(terms).toContain("表示名、種類、銘柄、日付、評価、味わいひとこと");
    expect(terms).toContain(
      "量、純アルコール量、価格、店名、座標、保管場所、私的メモ、メールは出しません",
    );
    expect(terms).toContain("古い投稿は復活しません");
    expect(terms).toContain("『友達に共有』を最初からオンにする");
    expect(terms).toContain("友達へ招待する相手も満20歳以上");
    expect(terms).toContain("セラーまたは友達の招待リンクを不特定多数へ公開すること");
    expect(terms).toContain("友達関係、近況投稿、リアクション、アプリ内通知");
    expect(privacy).toContain(
      "相互承認した友達は、利用者が参加または承認を選んだ相手であり、委託先ではありません",
    );
    expect(privacy).toContain("友達共有のホワイトリスト項目はその友達に開示されます");
    expect(privacy).toContain("共有セラーでは共有しません");
    expect(privacy).toContain(
      "量、純アルコール量、価格、店名、座標、保管場所、私的メモ、メールは出しません",
    );
    expect(privacy).not.toContain(
      "飲酒記録、ノート、評価、マイドリンク、位置情報、メールアドレスは共有しません",
    );
  });

  it("公開プロフィールやDMを約束せず、権利侵害の申出はご意見フォームへ向ける", () => {
    const terms = allTexts(TERMS_DOCUMENT).join("\n");
    const privacy = allTexts(PRIVACY_DOCUMENT).join("\n");
    expect(terms).toContain("公開プロフィール、公開フォロー、ユーザー検索は提供しません");
    expect(terms).toContain("ダイレクトメッセージ、コメント、返信は提供しません");
    expect(terms).toContain("権利侵害に関する申出");
    expect(terms).toContain("ログインし年齢確認を終えたうえで");
    expect(terms).toContain("ご意見・ご要望");
    expect(terms).toContain("/settings/feedback");
    expect(terms).toContain("その他");
    expect(terms).toContain("報告専用のボタンは設けません");
    expect(terms).toContain("開示請求があれば遅滞なく開示");
    expect(terms).toContain("改めての同意は求めません");
    expect(terms).toContain("他人の個人情報を無断でアップロードすること");
    expect(privacy).toContain("不特定多数への公開には使いません");
    expect(privacy).toContain("公開プロフィールや公開フォローもありません");
    expect(privacy).toContain("権利侵害に関する申出");
    expect(privacy).toContain("/settings/feedback");
    expect(privacy).toContain("その他");
    expect(privacy).toContain("要配慮個人情報としては扱いません");
    expect(privacy).toContain("開示請求があれば遅滞なく開示");
    expect(privacy).toContain("改めての同意は求めません");
    expect(terms).toContain("存在しないメールアドレスは記載しません");
    expect(privacy).toContain("存在しないメールアドレスは記載しません");
    expect(terms).not.toContain("専門家");
    expect(privacy).not.toContain("専門家");
    expect(terms).not.toContain("承認後");
    expect(privacy).not.toContain("承認後");
    expect(terms).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(privacy).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });
});
