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

- 入力 UI、Zod、POST API、自分のログのみ insert
- 保存後に日別またはホームへ戻り、トースト

**対象外**

- マイドリンク 1 タップ（3-03）
- 一覧の編集削除（3-05）。ただし同じ PATCH を先に作ってもよい

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
4. 保存中の二重送信防止
5. テスト
6. security-audit

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

- [ ] 仕様の項目が揃っている
- [ ] 最短タップ数が仕様どおり
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
