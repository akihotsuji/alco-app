# 4-02 ボトルCRUD

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | 登録・編集・削除、一覧（絞り込み・検索）、詳細 |
| ソース | Phase 4 ボトルCRUD |

## 1. 概要

写真なしでも完結するボトルの CRUD を先に出す。写真は 4-04 でフィールドを足す。

## 2. 前提条件

- cellar.md 承認
- Phase 2、D1 スキーマに bottles

## 3. スコープ

**対象**

- フォーム、一覧、詳細、編集、削除
- クエリ: 種類、ステータス、名前・生産者検索
- 全 API に認可

**対象外**

- 写真（4-04）
- ステータス専用 UI の磨き（4-03 と重複しうる。基本の enum 保存は本タスク）
- ノート一覧埋め込み（Phase 5-04）

## 4. 成果物

- shared Zod、routes、pages
- テスト: CRUD 正常系、401、他人 404、検索が自分の行のみ

## 5. 細分化タスク

1. Zod と enum
2. API
3. 一覧（空状態、フィルタ）
4. 作成・詳細・編集
5. 削除確認
6. テストと監査

## 6. 手順

```powershell
git checkout -b feature/bottles-crud
# shared → server → client
pnpm test && pnpm lint && pnpm typecheck
```

LIKE 検索は `%` をユーザー入力に含む場合のエスケープを決める（全部 match を防ぐ）。

## 7. 仕様詳細

- 一覧は新しい登録順。**要確認**
- ページング: 個人なら初期 50 件 + もっと見る
- 削除時ノートがある場合は cellar.md の方針（阻止推奨）

## 8. 受け入れ条件

- [ ] 登録〜検索〜編集〜削除が実機でできる（写真なし）
- [ ] 認可テスト
- [ ] DoD 5 項
- [ ] ユーザー入力はテキスト表示

## 9. セキュリティ観点

- 検索文字を SQL 連結しない
- userId スコープ
- 価格・メモの漏洩はログに出さない

## 10. 関連ファイル / 関連spec

- [spec/features/cellar.md](../../spec/features/cellar.md)
- [03-status-management.md](03-status-management.md)
- [04-photo-upload-r2.md](04-photo-upload-r2.md)

## 11. リスク・注意点

- フォームが長くモバイルで挫折する。セクション分割
- ヴィンテージを number にすると「NV」が入れない。text が安全。**要確認**
