# 4-02 ボトルの追加・詳細・編集・削除

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | 撮って追加（本数 N → N 行）、詳細（主「消費する」）、編集、削除 |
| ソース | Phase 4 ボトル CRUD。画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) `bottle-new` / `bottle-detail` / `bottle-edit` |

## 1. 概要

ボトルの作成・詳細・編集・削除を、設計どおりの画面で出す。棚（陳列）の見た目は 4-04、消費・貯蔵庫・開栓は 4-03。本タスク時点の `/cellar` は仮の一覧（棚の骨格だけ）でよい。

## 2. 前提条件

- cellar.md 承認
- Phase 2（D1 スキーマに 1-07 改訂後の `bottles`、2-08 写真パイプライン）
- Phase 3（`log-new?bottleId=` と「ボトル」行の有効化。本タスクで Phase 3 の非表示行を有効にする）

## 3. スコープ

**対象**

- `bottle-new`: 「+」→ `photo-edit`（2:3、`cellar`、キャラなし）から始まる。銘柄名・種類・本数（1〜12）・折りたたみ詳細。「棚に並べる（N 本）」
- `POST /api/bottles`（`count` 展開、`photoIds` の複製）→ 201 `{ items }`。最初の本の詳細へ
- `bottle-detail`: 写真 2:3 + 棚板、状態ピル、主「消費する」（4-03 で結線。本タスクでは disabled ではなく **出さない**）、副「開栓する」「1 杯を記録」、プロパティ、ノート節（Phase 5 まで空）、記録節
- `bottle-edit`: 本数なし、写真付け替え、削除（確認。ノート・記録は残る）
- `GET /api/bottles?view=&q=&drinkType=&status=`（一覧 API。棚 UI は 4-04）
- 全 API に認可。`log-new` の「ボトル」行とピッカー（`view=all&q=`）を有効化

**対象外**

- 棚の見た目（4-04）
- 消費 / 貯蔵庫 / 復元（4-03）
- ノート節の中身（5-04）

## 4. 成果物

- shared Zod（`count`、`status` は `opened` のみ PATCH 可）、routes、pages
- テスト: 作成（N 行、写真複製）、401、他人 404、検索が自分の行のみ、`log-new` のピッカーが自分のボトルのみ

## 5. 細分化タスク

1. Zod と enum（`sealed` / `opened` / `consumed`）
2. API（POST の展開、GET の `view`）
3. `bottle-new`（撮影から）
4. `bottle-detail` / `bottle-edit`
5. `log-new` のボトル行を有効化
6. テストと監査

## 6. 手順

```powershell
git fetch origin main
git checkout -b feature/bottles-crud origin/main
# shared → server → client
pnpm test; pnpm lint; pnpm typecheck
```

LIKE 検索は `%` `_` をエスケープ。

## 7. 仕様詳細

- 一覧は `view=cellar` で `createdAt` 降順、`archive` は `consumedAt` 降順
- ページング: cursor（api-design 2.7）。棚は 2 段（6 本）ずつ追加取得
- 削除時ノート・記録は SET NULL（阻止しない。確認文で伝える）
- ヴィンテージは `integer | null`（NV = null。data-model 確定）

## 8. 受け入れ条件

- [ ] 撮って登録〜検索〜編集〜削除が実機でできる。N 本が N 行になる
- [ ] [04-cellar.md](../../spec/screen-designs/04-cellar.md) の受け入れチェックのうち `bottle-new` / `bottle-detail` / `bottle-edit` 項目
- [ ] 認可テスト
- [ ] DoD 5 項
- [ ] ユーザー入力はテキスト表示

## 9. セキュリティ観点

- 検索文字を SQL 連結しない
- userId スコープ。`photoIds` は自分の未紐付け写真のみ
- 価格・メモの漏洩はログに出さない

## 10. 関連ファイル / 関連spec

- [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md)
- [spec/features/cellar.md](../../spec/features/cellar.md)
- [03-status-management.md](03-status-management.md)
- [04-photo-upload-r2.md](04-photo-upload-r2.md)
- [../phase-02-platform/08-photo-pipeline.md](../phase-02-platform/08-photo-pipeline.md)

## 11. リスク・注意点

- N 行展開で写真を N 個に複製するため R2 put が N 回。上限 12 で許容
- 詳細の「消費する」を 4-03 前に出すと壊れた導線になる。出さない
