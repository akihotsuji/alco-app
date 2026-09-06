# 3-02 記録入力画面

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 3 飲酒記録 |
| ステータス | **未着手** |
| 要件 | 種類選択→量・度数プリセット→保存を最短タップ数で |
| ソース | Phase 3 記録入力画面 |

## 1. 概要

コア UX。グラス 1 杯を保存する画面。計算表示は 3-04 の shared 関数を使う（未実装なら本 PR で 3-04 を先に、または同時。1PR1 関心なら計算を先の PR）。

## 2. 前提条件

- `spec/features/drink-log.md` 承認
- Phase 2 完了
- 3-04 の `calculateAlcoholGrams` が import できること（推奨順）

## 3. スコープ

**対象**

- 入力 UI（[spec/screen-designs/03-log.md](../../spec/screen-designs/03-log.md) `log-new` の要素表どおり）、Zod、POST API、自分のログのみ insert
- 写真タイル（120px、`surprised` 48px）→ 2-08 の `photo-edit`（4:5、`table`、キャラ合成）。`?camera=1` で自動起動。`photoIds`（最大 1）を POST に含める
- 量チップにボトル量 375 / 750 / 1500
- 保存後に対象日の `log-day?highlight=<id>` へ即遷移、トースト（`cheer`）
- **モーション共通基盤**（[spec/motion-design.md](../../spec/motion-design.md) 6 章。ここで 1 回作り、以後のタスクは使うだけ）
  - `styles.css` に `--ease-*` / `--dur-*` / `--fill-tint*` トークンと `html[data-reduce-motion="1"]` ブロック。ダークの `--primary` / `--score` / `--ring` を `#CC8484` に（X8。`design-tokens.ts` とテストも追従）
  - `Button` の押下（M-01 / M-02。`scale(0.985) translateY(1px)`、`::after` で inset）と `data-state="loading|error"` の水位線（M-04〜M-06）。`Chip` の M-31
  - `useReducedMotion()`（`src/client/hooks/use-reduced-motion.ts`。OS 設定 or `ui.reduce-motion`）、`AppShell` が `<html data-reduce-motion>` を付け外し
  - `src/client/lib/haptic.ts`（`light` / `success`。`ui.haptic` が ON の端末だけ。未対応は no-op）
  - トーストの出入り M-23 / M-24 と `Mascot` の `pour`（M-25）、ダイアログ M-13 / M-30、スケルトン M-29、空状態 M-26 / M-27
  - 保存失敗時のオフライン文言（X4）

**対象外**

- マイドリンク 1 タップ（3-03）
- 一覧の編集削除（3-05）。ただし同じ PATCH を先に作ってもよい
- ボトル行のピッカー（Phase 4-02 で有効化。行は非表示にしてよい）

## 4. 成果物

- `src/shared` の create schema
- `src/server/routes/drink-logs.ts`（POST）
- 入力画面コンポーネント
- API テスト（201、401、バリデーション 400）
- 認可: userId はセッション

## 5. 細分化タスク

1. shared Zod（drinkType enum、volume、abv、drunkAt、memo）
2. POST API + サーバーで alcohol_g 再計算
3. UI: 種類チップ、量プリセット、度数、保存
4. 保存中の二重送信防止（`data-state="loading"` + 水位線）
5. モーショントークン・`useReducedMotion`・`haptic.ts`・`Mascot pour`・トースト出入り（単体テスト: reduced motion 判定、haptic の no-op、`pour` が `cheer` 以外で無効）
6. テスト
7. security-audit

## 6. 手順

```powershell
git checkout -b feature/drink-log-create
```

feature-dev 順: shared → db（カラム既存のはず）→ server → client。

```powershell
pnpm test
pnpm lint
pnpm typecheck
```

手動: 390px 幅で種類→プリセット→保存が仕様のタップ数で終わること。

## 7. 仕様詳細

- 種類変更で量・度数デフォルト（要件 1.2 の表）を投入する。その後 **記録ごとに量・度数を修正できる**
- ユーザーが既に量・度数を触ったあとに種類を変えた場合は、新しい種類のデフォルトで上書きする（触った値は捨てる）。例外が必要なら drink-log.md で上書きする
- 表示用 g はキー入力のたびに shared 関数
- POST ボディに `alcoholG` を入れてもサーバーは無視して再計算

API: `POST /api/drink-logs`（api-design どおり）

## 8. 受け入れ条件

- [ ] 仕様の項目が揃っている（[03-log.md](../../spec/screen-designs/03-log.md) の受け入れチェックを PR に貼る）
- [ ] 最短タップ数が仕様どおり（写真なしで保存 1 タップ）
- [ ] 写真タイル → `photo-edit` → 保存で `drink_log_id` が付く。未保存で戻ると写真が削除される
- [ ] 単体（計算）と API（認可含む）テスト
- [ ] lint / typecheck / test
- [ ] spec 同期
- [ ] security-audit Critical/High ゼロ

## 9. セキュリティ観点

- Zod で範囲制限（度数 0〜100、量上限）
- メモはテキスト表示、`dangerouslySetInnerHTML` 禁止
- insert の userId はセッション

## 10. 関連ファイル / 関連spec

- [spec/features/drink-log.md](../../spec/features/drink-log.md)
- [04-alcohol-calc-logic.md](04-alcohol-calc-logic.md)
- [01-spec-drink-log.md](01-spec-drink-log.md)

## 11. リスク・注意点

- datetime-local のタイムゾーンずれ
- キーボードで下部保存ボタンが隠れる（1-02 の注記）
