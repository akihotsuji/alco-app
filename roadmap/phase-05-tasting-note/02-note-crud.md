# 5-02 ノートCRUD

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 5 テイスティングノート |
| ステータス | **未着手** |
| 要件 | 作成フォーム（4 要素 + 5 段階）、一覧・検索、詳細 |
| ソース | Phase 5 ノートCRUD |

## 1. 概要

写真とボトル連携を任意にした状態でノートの CRUD を完成させる。写真 UI は 5-03、ボトル導線の磨きは 5-04。

## 2. 前提条件

- tasting-note.md 承認
- bottles API（bottleId 検証用）
- Phase 2

## 3. スコープ

**対象**

- 作成・編集・削除・詳細・一覧
- 検索: 銘柄名、種類、評価
- 評価入力
- 認可

**対象外**

- 複数写真 UI（API に photoIds 空配列は可）
- ボトル詳細への埋め込み完成形

## 4. 成果物

- shared Zod、routes、画面
- テスト: CRUD、401、他人 404、他人 bottleId 404、評価 3.3 など不正値 400

## 5. 細分化タスク

1. rating を Zod `.multipleOf(0.5)` または整数
2. API
3. フォーム（モバイル、テキストエリア 4）
4. 一覧フィルタ
5. テストと監査

## 6. 手順

```powershell
git checkout -b feature/tasting-notes-crud
pnpm test && pnpm lint && pnpm typecheck
```

feature-dev 順。bottleId があるとき `bottles` を userId 付きで存在確認してから insert。

## 7. 仕様詳細

- 手入力銘柄のとき bottleId は null、name 必須
- ボトル選択時 name はサーバーが埋めるかクライアント表示のみ（仕様どおり）
- 削除確認

## 8. 受け入れ条件

- [ ] 4 テキスト + 評価で保存・検索・詳細ができる
- [ ] 認可・不正 rating のテスト
- [ ] DoD 5 項
- [ ] テキストレンダリングのみ

## 9. セキュリティ観点

- bottleId を信用せず所有確認
- 検索 LIKE のエスケープ
- 評価範囲外を DB に入れない

## 10. 関連ファイル / 関連spec

- [spec/features/tasting-note.md](../../spec/features/tasting-note.md)
- [03-multi-photo-attach.md](03-multi-photo-attach.md)
- [04-cellar-integration.md](04-cellar-integration.md)

## 11. リスク・注意点

- テキストエリア 4 + キーボードで保存ボタンが隠れる
- 種類フィルタはボトル由来かノート独自列かでクエリが変わる
