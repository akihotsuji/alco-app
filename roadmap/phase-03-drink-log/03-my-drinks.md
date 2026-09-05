# 3-03 マイドリンク（プリセット）の登録・1タップ記録

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 3 飲酒記録 |
| ステータス | **未着手** |
| 要件 | よく飲む組み合わせをプリセットし 1 タップ記録 |
| ソース | Phase 3 マイドリンク |

## 1. 概要

マイドリンク CRUD と、ホーム等からの 1 タップで drink_log を切る機能。ログにはプリセット値をコピーし、後のプリセット編集が過去に影響しない。

## 2. 前提条件

- 3-01 承認、3-02 の POST ログ API
- データモデルの `my_drinks`

## 3. スコープ

**対象**

- マイドリンクの作成・一覧・編集・削除（[spec/screen-designs/03-log.md](../../spec/screen-designs/03-log.md) `mydrink-*`）
- 1 タップ記録（現在時刻、コピーした type/volume/abv）。ホームと日別の両方にチップ（最大 4）
- 件数上限 30（data-model 5.6 で確定）
- ホームの今日カードとキャラクター（`default` / `rest`、1 タップ後 `cheer` 300ms。[spec/screen-designs/02-home.md](../../spec/screen-designs/02-home.md)）

**対象外**

- 並び替え DnD（sort_order カラムがあれば手動数値で可）
- ボトルからのマイドリンク生成

## 4. 成果物

- `/api/my-drinks` CRUD
- `POST /api/my-drinks/:id/log`（1-05 で必須。サーバーがプリセットをコピー）
- UI: 管理画面とホームのショートカット
- テスト: 1 タップが自分のログになる、他人の my_drink id で 404

## 5. 細分化タスク

1. shared Zod
2. API CRUD + 1 タップ endpoint
3. 管理 UI
4. ホームにショートカット（2-05 の空ホームを埋める）
5. 他人 ID の 404 テスト
6. 監査

## 6. 手順

ブランチ: `feature/my-drinks`

1 タップの実装は「クライアントが値を展開して POST /drink-logs」でも「サーバーが my_drink を読む」でも可。**推奨はサーバーが読む**（改ざんされず、削除済み ID は 404）。仕様に明記。

```powershell
pnpm test && pnpm lint && pnpm typecheck
```

## 7. 仕様詳細

- 削除済みマイドリンクの 1 タップ: 404、ログは作らない
- 編集は未来の 1 タップのみ影響
- 名前は必須、最大長 **要確認**（例 40）
- ホームに出す件数 **要確認**（例 最大 4、残りは一覧へ）

## 8. 受け入れ条件

- [ ] 登録と 1 タップが実機でできる
- [ ] 過去ログがプリセット編集で変わらない
- [ ] 他ユーザーのプリセット ID で記録できないテスト
- [ ] DoD 5 項（spec, テスト, lint, 同期, 監査）

## 9. セキュリティ観点

- `:id` + session userId で my_drinks を検索
- クライアントが任意の volume を 1 タップ API に混ぜない（サーバーコピー）

## 10. 関連ファイル / 関連spec

- [spec/features/drink-log.md](../../spec/features/drink-log.md)
- [02-log-input-screen.md](02-log-input-screen.md)

## 11. リスク・注意点

- 誤タップで記録が積もる → 仕様の undo / トースト「取り消す」を **要確認**
- ホームの 1 タップとタブ「記録」の役割分担
