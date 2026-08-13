# 5-03 写真複数枚添付

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 5 テイスティングノート |
| ステータス | **未着手** |
| 要件 | 写真（複数枚）、Phase 4 基盤再利用 |
| ソース | Phase 5 写真複数枚添付 |

## 1. 概要

既存のリサイズ・R2・認可を使い、1 ノートに複数写真を付ける。新しいストレージ方式を発明しない。

## 2. 前提条件

- 4-04 完了
- 5-02 のノート
- 枚数上限が tasting-note.md にある

## 3. スコープ

**対象**

- 作成/編集での複数選択、順序（**要確認**: 順序を持つか）
- 詳細のギャラリー
- 追加・削除（R2 削除方針は 4-04 に合わせる）
- テスト: 上限超過 400、他人の photo id を紐付け 404

**対象外**

- 画像編集フィルタ
- 動画

## 4. 成果物

- photos.tasting_note_id または中間テーブル（data-model どおり）
- UI
- テスト

## 5. 細分化タスク

1. データモデルどおり関連を実装（未実装なら migration）
2. 既存 upload API を再利用。ノート作成後に紐付けか、先アップロードか。**推奨: 先に photo レコードをユーザー所有で作り、ノート保存時に id 配列**。他人の id 混入を拒否
3. UI: サムネ横スクロール、追加ボタン
4. 遅延読み込みは Phase 6-03 でも可。今は `loading=lazy`
5. テストと監査

## 6. 手順

ブランチ: `feature/note-photos`

新しい `/api/upload-public` を作らない。4-04 のルートを拡張するだけ。

```powershell
pnpm test
```

## 7. 仕様詳細

- 上限 N 枚。N+1 で 400
- 並び順 column `sort_order`
- ボトル写真とノート写真は同じ photos テーブルで owner が排他

## 8. 受け入れ条件

- [ ] 複数枚を付けて詳細で見られる
- [ ] 基盤の再利用（重複実装なし）
- [ ] 他人の写真 ID を紐付けできないテスト
- [ ] DoD 5 項

## 9. セキュリティ観点

- 紐付け時も photo.user_id === session
- MIME 再検証はアップロード時で足りるが、紐付けだけ別ユーザーは不可
- ギャラリーの URL も認可付き

## 10. 関連ファイル / 関連spec

- [../phase-04-cellar/04-photo-upload-r2.md](../phase-04-cellar/04-photo-upload-r2.md)
- [spec/features/tasting-note.md](../../spec/features/tasting-note.md)

## 11. リスク・注意点

- 同時アップロードで上限レース。サーバーで count + transaction 相当（SQLite）
- 大きな HEIC 複数で Workers CPU 時間
