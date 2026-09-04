# 1-03 デザインシステム定義

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 1 設計 |
| ステータス | **レビュー待ち**（成果物: [spec/design-system.md](../../spec/design-system.md)） |
| 要件 | ニューモーフィズム、モバイル、PWA、OS追従 |
| ソース | Phase 1「デザインシステム定義 → spec/design-system.md」 |

## 1. 概要

配色・タイポグラフィ・余白・コンポーネント方針を文書化し、Phase 2-06 の Tailwind トークンと shadcn の正本にする。

## 2. 前提条件

- 1-02 のワイヤーが並行または完了
- 実装はしない。トークン名だけ決めてよい

## 3. スコープ

**対象**

- カラー（**ライト／ダーク両方。OSの外観設定に追従**。アプリ内切替は持たない）
- フォント、サイズスケール
- スペーシング、角丸、影
- コンポーネント方針（Button、Input、Card、Tabs、Dialog/Sheet、Toast）
- タップ領域の最小サイズ（Phase 6-04 でも使う。ここで 44px を宣言推奨）

**対象外**

- 全コンポーネントの Storybook（導入しない。shadcn がコードとして残る）
- イラスト・マスコット
- ブランドロゴ制作の外注

## 4. 成果物

- `spec/design-system.md`（Phase 1 DoD）
- rule `ui-design`（`.cursor/rules/ui-design.mdc`、globs: `src/client/**`）を同じ PR または直後に追加

## 5. 細分化タスク

1. トーンのキーワードを決める（2026-09-04 改訂: **ニューモーフィズム**。Win98 は破棄）
2. ライト／ダーク両方の色トークン（background / surface / primary / danger / muted / border）を定義する（OS追従は 2026-08-13 確定）
3. 本文と背景のコントラスト 4.5:1 をライト・ダーク両方で満たす
4. タイプスケール（見出し、本文、キャプション）
5. コンポーネント方針と「マジックナンバー禁止」を rule に落とす
6. オーナー承認

## 6. 手順

1. `spec/design-system.md` を作成する。構成案:

- 原則（モバイル幅、ニューモーフィズム、コントラスト）
- カラー（ライト／ダーク。HEX または OKLCH。WCAG コントラストを表で示す）
- タイポグラフィ（**システムフォントのみ**。PWA 初回 3 秒制約）
- Spacing（4px グリッド推奨）
- コンポーネント（shadcn をベースに、どの variant を使うか）
- アイコン（lucide 等。追加依存は PR に理由）
- Do / Don't

2. `.cursor/rules/ui-design.mdc` を追加する:

- トークン経由の色のみ
- モバイルファースト
- 画面を巨大コンポーネントにしない

3. 承認 PR: `docs: デザインシステムを追加`

## 7. 仕様詳細

**確定（2026-08-13）**: テーマは **端末・OSの外観設定に追従**する。ライト／ダーク両方のパレットを定義する。アプリ内のテーマ切替は持たない（`prefers-color-scheme` のみ）。

**確定（2026-09-04）**

- 全体方針は **ニューモーフィズム**。`--surface` は地と同色
- primary は **ワイン**（ライト `#7A3538`）
- danger は削除確認にだけ使う
- 本文は 16px 以上（iOS ズーム防止）
- フォントはシステムスタック
- shadcn は **Default + Stone**。枠は影で置き換える

アクセシビリティ:

- 本文と背景はコントラスト 4.5:1 以上をライト・ダーク両方で満たす（Phase 6-04 の先取り）
- フォーカスリングを消さない

shadcn:

- Default（確定）
- ベースは Stone（確定）

## 8. 受け入れ条件

- [x] `spec/design-system.md` がある（オーナー承認は PR。Phase 1 DoD）
- [x] トークン名が実装時にコピーできる
- [x] ライト／ダーク両方のパレットが定義され、OS追従であることが書いてある
- [x] ui-design ルールがある（`.cursor/rules/ui-design.mdc`）
- [x] フォントライセンスを無視していない（システムフォントのみ）

## 9. セキュリティ観点

- 外部フォント CDN を使う場合、CSP（`hono/secure-headers`）に載せる必要が出る。**セルフホストまたはシステムフォントが安全**
- ユーザー指定色は無い前提

## 10. 関連ファイル / 関連spec

- 正本: [spec/design-system.md](../../spec/design-system.md)
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) Tailwind + shadcn
- 実装: [../phase-02-platform/06-design-tokens-shadcn.md](../phase-02-platform/06-design-tokens-shadcn.md)

## 11. リスク・注意点

- ダーク側でコントラスト不足のグレー文字になりやすい。ライト・ダークとも 4.5:1 を満たすこと
- トークン未定義のまま shadcn デフォルト（ライト固定）で実装すると手戻り
