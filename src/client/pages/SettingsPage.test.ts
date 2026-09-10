import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "SettingsPage.tsx"),
  "utf8",
);

describe("SettingsPage S11 / S12", () => {
  it("操作節に使い方を見るがあり、扇からツアーを始める", () => {
    expect(source).toContain("使い方を見る");
    expect(source).toContain("GuideFanMenu");
    expect(source).toContain("guide.openPicker");
    expect(source).toContain("guide.startTour");
    expect(source).toContain("needsGuideFanReveal");
    expect(source).toContain("scrollIntoView");
    expect(source).not.toContain("guide.replay()");
    expect(source).not.toContain("健康");
  });

  it("このアプリ節から利用規約とプライバシーポリシーへ辿れる", () => {
    expect(source).toContain("このアプリ");
    expect(source).toContain('legalHref("/terms", "settings")');
    expect(source).toContain('legalHref("/privacy", "settings")');
  });

  it("版表記は公開名称とバージョンを並べ、仮名 alco-app を出さない", () => {
    expect(source).toContain("PWA_NAME");
    expect(source).toContain("APP_VERSION");
    expect(source).not.toContain("alco-app");
  });

  it("色補正設定は出さず、外部 AI への送信を書く", () => {
    expect(source).not.toContain("色補正");
    expect(source).not.toContain("getColorCorrectionPref");
    expect(source).toContain("新しい写真に合成します。過去の写真は変えません");
    expect(source).toContain("写真を Cloudflare 経由の外部 AI に送ります");
    expect(source).toContain("Cloudflare 経由の外部 AI");
    expect(source).not.toContain("Workers AI");
    expect(source).not.toContain("Gemini 3.7");
  });

  it("記録節に現在地を記録するがある", () => {
    expect(source).toContain("記録");
    expect(source).toContain("RecordLocationPrefRow");
    expect(source.indexOf('<h2 className="settings-heading">記録</h2>')).toBeGreaterThan(
      source.indexOf('<h2 className="settings-heading">セラー</h2>'),
    );
    expect(source.indexOf('<h2 className="settings-heading">表示</h2>')).toBeGreaterThan(
      source.indexOf('<h2 className="settings-heading">記録</h2>'),
    );
  });
});
