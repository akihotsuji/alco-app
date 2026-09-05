# Phase 1: 設計

| 項目 | 内容 |
|---|---|
| 目安 | 3〜5日 |
| 状態 | 1-01〜1-06 完了（2026-09-04 承認）。**1-07 / 1-08 レビュー待ち**（2026-09-05 追加） |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 1 |

## 目的

実装前に「何をどう作るか」を文書化し、後続フェーズの手戻りをなくす。コード変更は原則このフェーズでは行わない（例外: 設計確認用の throwaway スケッチをオーナーが明示した場合のみ）。

## 依存

- Phase 0 のルール・リポジトリが使えること（設計作業自体はドキュメントのみなので、Hello World 未完了でも開始可）
- オーナーが毎日レビューできること（ワイヤーとデザイン決定は合意が完了条件）

## ゴール（フェーズ DoD）

- `spec/design-system.md` / `spec/data-model.md` / `spec/api-design.md` がレビュー・承認済み
- ワイヤーフレームについてオーナーの合意が取れている
- 純アルコール量の式とグラスプリセットが数値まで確定している

## タスク一覧

| # | ファイル | 成果物 |
|---|---|---|
| 01 | [画面一覧とナビ](01-screens-navigation.md) | 画面インベントリ、下部タブ IA |
| 02 | [ワイヤーフレーム](02-wireframes.md) | 主要画面の構成（テキスト or 図） |
| 03 | [デザインシステム](03-design-system.md) | `spec/design-system.md` |
| 04 | [ER / Drizzle](04-er-drizzle-schema.md) | `spec/data-model.md` |
| 05 | [API設計](05-api-design.md) | `spec/api-design.md` |
| 06 | [計算・プリセット](06-alcohol-calc-presets.md) | [spec/features/alcohol-calculation.md](../../spec/features/alcohol-calculation.md) |
| 07 | [詳細画面設計](07-detailed-screen-design.md) | [spec/screen-designs/](../../spec/screen-designs/README.md)、モック更新、data-model / api の 1-07 改訂 |
| 08 | [キャラクター](08-character-mascot.md) | [spec/character.md](../../spec/character.md)、[spec/assets/character/](../../spec/assets/character/) |

推奨順: 01 → 02 と 03 は並行可。04 と 06 を固めてから 05（API はデータモデルに依存）。07 と 08 は 01〜06 の後に並行（同じ PR）。

## このフェーズで整備する rules

実装開始（Phase 2）までに作成する。本フェーズのタスク 03/04 の成果物とセットでよい。

- rule: `database`（`src/db/**`）— **1-04 で作成済み**（`.cursor/rules/database.mdc`）。マイグレーション必須、命名規約
- rule: `ui-design`（`src/client/**`）— 追加済み（1-03）。トークン使用、モバイルファースト、ニューモーフィズム

## 終了後にできること

Phase 2 のスキーマ実装・認証・レイアウトに着手できる。

## 確定（2026-08-13）

- **UIテーマは端末・OSの外観設定に追従**（ライト／ダーク両方。アプリ内切替は持たない）
- **招待制は採用しない**
- **グラスプリセット**は要件 1.2 の表。記録ごとに量・度数を修正できる
- **日付境界は Asia/Tokyo**

## 確定（2026-09-04）

- **下部タブは一旦 5 つ**（ホーム / 記録 / セラー / ノート / 設定）。正本は [spec/screens.md](../../spec/screens.md)
- **配置メタファー**（1-02）: エクスプローラ一覧＋ウィンドウ。記録入力はフルスクリーン。FAB なし。1 タップ undo は 5 秒。正本は [spec/wireframes.md](../../spec/wireframes.md)
- **トーン方針**（1-03）: **ニューモーフィズム**。主ボタンはワイン系。Win98 方針は破棄。ゲーミフィケーションはスコアと押下まで
- **計算・プリセット**（1-06）: 保存は小数第 2 位、表示は第 1 位。量 1〜5000ml、度数 **0〜100%（0% 可）**。ボトル丸ごとも記録可。正本は [spec/features/alcohol-calculation.md](../../spec/features/alcohol-calculation.md)
- **ワイヤー / デザイン / ナビ / データモデル / API**: 当面このまま。画面細部とセラー風写真背景は後続

## 指示（2026-09-05。1-07 / 1-08。承認待ち）

- **詳細画面設計を正本にし、実装はそのとおりに作る**（[spec/screen-designs/](../../spec/screen-designs/README.md)）
- 下部タブは **ホーム / セラー / 記録（中央・円形） / ノート / 設定**
- セラーは **棚（陳列）**。操作は追加と消費。消費で **貯蔵庫** へ移り、その日の記録に 1 杯を追加して日別へ遷移
- 記録・ノートは **写真を撮って付ける**（任意。最短タップは維持）
- **キャラクター 1 体**（赤ワイングラス + 目）。写真右下に合成できる
- 2026-09-04 の「セラー風背景は将来」「中央タブ不採用」「データモデルは当面このまま」は上記で **覆す**

## 要確認（フェーズ横断・残）

- 1-07 の要確認（中央タブの着地 / 本数上限 / ノート写真枚数 / キャラの仮称）。既定は [spec/screen-designs/README.md](../../spec/screen-designs/README.md)
- SE 幅の折り返しは 2-05
