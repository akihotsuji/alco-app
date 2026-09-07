# 5-05 ノート APIテスト・コンポーネントテスト

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 5 テイスティングノート |
| ステータス | **完了**（2026-09-07） |
| 要件 | 認可を含む API テスト、コンポーネントテスト |
| ソース | Phase 5「APIテスト・コンポーネントテスト」 |

## 1. 概要

5-02〜5-04 のテストギャップを埋め、MVP 3 機能の回帰を CI で守る。E2E は Phase 6。

## 2. 前提条件

- ノート CRUD、写真複数、セラー連携の実装が main にある
- Phase 4-05 のテストヘルパ（`createTestApp` / `createTestUser`）を再利用。ボトル+ノート+写真のセットアップは `src/server/tasting-note-factory.ts` に集約
- Vitest。Testing Library / jsdom は入れない（コンポーネントはソース隣の契約テスト + 純関数）

## 3. スコープ

**対象**

- API 認可・バリデーション・bottleId・photo 紐付け
- 評価入力コンポーネント
- 一覧フィルタ
- CI

**対象外**

- 新機能、E2E、リファクタのみの大規模整理（混ぜない）
- Phase 3〜5 を横断する実機探索（Phase 5.5）

## 4. 成果物

- 不足テストの追加
- 本ファイルのテスト一覧（下記）とロードマップ更新

## 5. 細分化タスク

1. 既存テストを棚卸し（表）
2. 欠けた 404/400 を追加
3. 評価ステッパーのコンポーネントテスト（0.5 刻み、上限 5）
4. 全テストパス
5. 監査

## 6. 手順

```powershell
pnpm test && pnpm lint && pnpm typecheck
```

必須ケースと実装後の担保:

| ケース | 期待 | 担保 |
|---|---|---|
| 未認証 | 401 | `tasting-notes.test.ts`（POST / GET 一覧 / GET :id / PATCH / DELETE） |
| 他人ノート GET/PATCH/DELETE | 404。403 ではない | 同上 |
| 他人 bottleId で POST | 404 | 同上 |
| 他人 photoId 紐付け | 404 | 同上 |
| rating 5.1 / 1.2 | 400 | 同上 + `tasting-notes.test.ts`（shared） |
| 写真 N+1 | 400 | 同上 |

R2 は `createTestApp()` のメモリバケット。CI で skip しない。

## 7. 仕様詳細

coding-standards: テストはソース隣。コンポーネントはユーザー操作（評価ステッパー・検索・種類・★4 以上）を純関数と契約テストで見る。

写真バイナリは `src/server/image-fixtures.ts` の生成バイト。実在ラベル写真は使わない。

## 8. テスト一覧（棚卸し）

### API

| ケース | ファイル | 5-05 |
|---|---|---|
| POST / GET / PATCH / DELETE。未認証 401、他人 404 | `src/server/routes/tasting-notes.test.ts` | 既存 + GET/DELETE :id の 401、不在と同じ 404 本文 |
| 他人 bottleId の POST / 一覧 / PATCH。不明 bottleId の一覧は 404 | 同上 | 既存 + PATCH 他人 bottleId、不明一覧 |
| 他人 photoId / 他ノートの id は 404。7 枚は 400 | 同上 | 既存 |
| rating 5.1 / 1.2 / 3.3 は POST / PATCH 400 | 同上 | **追加**（5.1 / 1.2） |
| 一覧クエリ drinkType=evil / ratingX10Min=51 / 12 / limit 0・101 / 長い q は 400 | 同上 | **追加** |
| ratingX10Max の上限フィルタ。totalCount はフィルタ前 | 同上 | **追加** |
| 4 欄 2001 文字・重複 photoIds・PATCH の userId キーは 400 | 同上 | **追加** |
| T6: bottleId + limit=3、貯蔵庫、他人 404 | 同上 | 5-04 |
| 検索 `%` `_` リテラル、cursor ページング | 同上 | 既存 |

### 単体

| ケース | ファイル | 5-05 |
|---|---|---|
| ratingX10 の 5 刻み、5.1 / 1.2 拒否、ステッパー 1.0〜5.0 | `src/shared/tasting-notes.test.ts` | 既存 + **5.1 / 1.2** |
| Zod の未来日・7 枚・未知キー | 同上 | 既存 |
| フォームの評価 51 / 12 は保存不可 | `src/client/lib/note-form.test.ts` | **追加** |
| ツールバー操作で q / 種類 / ★4 以上が付く | `src/client/lib/history-state.test.ts` / `NoteToolbar.test.ts` | 既存 + **種類・検索** |
| ボトル+ノート+写真 factory | `src/server/tasting-note-factory.ts` | **追加** |

### コンポーネント

| ケース | ファイル | 5-05 |
|---|---|---|
| 評価ステッパー（0.5 刻み、上限 5、星は整数） | `src/client/components/notes/RatingField.test.ts` | **追加** |
| 一覧フィルタ（検索・種類・★4 以上） | `src/client/components/notes/NoteToolbar.test.ts` | **追加** |
| 空状態 / フィルタ 0 / 他人 bottleId は not-found | `src/client/components/notes/NoteList.test.ts` | **追加** |
| 詳細の 4 欄順・テキスト描画・ボトル行 | `src/client/components/notes/NoteDetail.test.ts` | **追加** |
| 写真ストリップ / カルーセル | `src/client/components/notes/NotePhotoStrip.test.ts` | 5-03 |
| ボトル詳細 T6 | `src/client/components/cellar/BottleNotesSection.test.ts` | 5-04 |

## 9. 受け入れ条件

- [x] 上記系のテストが存在する
- [x] CI グリーン（lint / typecheck / test）
- [x] 403 で存在漏洩していない
- [x] DoD の監査
- [x] 新機能を混ぜない

## 10. セキュリティ観点

security-audit のテスト【High】をノート API すべてに適用。

- テストが「403 で存在漏洩」していないこと（期待は 404 / 未認証は 401）
- フィクスチャに実在するラベル写真を使わない。生成 JPEG のみ

## 11. 関連ファイル / 関連spec

- [02-note-crud.md](02-note-crud.md)
- [03-multi-photo-attach.md](03-multi-photo-attach.md)
- [04-cellar-integration.md](04-cellar-integration.md)
- [spec/features/tasting-note.md](../../spec/features/tasting-note.md) 4 / 9 / 10 / 14
- [.cursor/skills/security-audit/SKILL.md](../../.cursor/skills/security-audit/SKILL.md)

## 12. リスク・注意点

- テストデータでボトル+ノート+写真のセットアップが重い。factory ヘルパを `tasting-note-factory.ts` に 1 箇所へ置いた
- R2 は `createTestApp()` のメモリバケット。wrangler / Miniflare は使わない（0-06 / 2-07 / 4-05 と同じ）
