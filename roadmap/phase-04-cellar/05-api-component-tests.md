# 4-05 セラー APIテスト・コンポーネントテスト

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **完了**（2026-09-07） |
| 要件 | API に認可テスト、主要コンポーネントテスト |
| ソース | Phase 4「APIテスト・コンポーネントテスト」 |

## 1. 概要

4-02〜4-04・4-07 のテスト穴を塞ぎ、Phase 4 DoD を満たす。各機能 PR にテストが付いているのが本則。本タスクはギャップ埋めと一覧。

## 2. 前提条件

- ボトル CRUD、ステータス、写真、ラベル読み取りの実装が main にある
- Vitest。Testing Library / jsdom は [02-tech-stack.md](../../spec/02-tech-stack.md) の 0-06 FIX どおり入れない（コンポーネントはソース隣の契約テスト + ツールバー操作の純関数）

## 3. スコープ

**対象**

- API: CRUD、検索スコープ、401、404 統一、写真 MIME/サイズ、他人の写真、consume / restore / recognize
- コンポーネント: フィルタ、フォームバリデーション表示、ステータスバッジ
- CI グリーン

**対象外**

- Playwright E2E（Phase 6）
- 新機能
- Testing Library / jsdom の導入

## 4. 成果物

- 不足テストの追加
- 本ファイルのテスト一覧（下記）とロードマップ更新

## 5. 細分化タスク

1. 既存テストを棚卸し（表）
2. 欠けている認可ケースを追加
3. リサイズ関数の単体テスト（幅が上限以下）
4. コンポーネントテスト 2〜3
5. `pnpm test` 全パス
6. security-audit

## 6. 手順

```powershell
pnpm test
pnpm lint
pnpm typecheck
```

ギャップ例と実装後の期待:

| ケース | 期待 | 担保 |
|---|---|---|
| 未ログイン GET /api/bottles | 401 | `bottles.test.ts` |
| B の bottle id を A が GET | 404 | `bottles.test.ts` |
| B の bottle を A が PATCH | 404。A の行は未変更 | `bottles.test.ts` |
| status=evil / drinkType=evil | 400（未知キー / enum） | `bottles.test.ts` / `shared/bottles.test.ts` |
| content-type: text/html アップロード | **415**（magic bytes。申告 MIME は信用しない） | `photos.test.ts` / `bottles-recognize.test.ts` |
| 申告 text/html + JPEG magic | 201 / 200 | 同上 |
| A の写真 content を B の Cookie で GET | 404 | `photos.test.ts` |
| recognize 日次 31 回目 | 429。他ユーザーは独立 | `bottles-recognize.test.ts` |

R2 は `createTestApp()` のメモリバケット。CI で skip しない。

## 7. 仕様詳細

coding-standards: テストはソース隣。コンポーネントはユーザー操作（種類選択・検索）でフィルタが絞ることを `applyCellarToolbarParams` で見る。

写真バイナリは `src/server/image-fixtures.ts` の生成バイト（単色 JPEG / HTML）。実在ラベル写真は使わない。

## 8. テスト一覧（棚卸し）

### API

| ケース | ファイル | 4-05 |
|---|---|---|
| POST / GET / PATCH / DELETE bottles。未認証 401、他人 404 | `src/server/routes/bottles.test.ts` | 既存 + PATCH 後の未変更確認 |
| 検索が自分の行のみ。`%` リテラル。totalCount はフィルタ前 | 同上 | 既存 |
| view / cursor / drinkType / status / q / limit の 400 | 同上 | **追加** |
| cursor ページング。他人は混ざらない | 同上 | **追加** |
| 未来の purchasedOn 400。同名許可 | 同上 | **追加** |
| 他人の photoIds は PATCH でも 404 | 同上 | **追加** |
| consume / restore。未認証 401、他人・状態不一致 404、記録を作らない / 消さない | 同上 | 既存 |
| N 本のうち 1 本だけ開栓 | 同上 | **追加** |
| POST /api/photos MIME・1MB・長辺・他人紐付け | `src/server/routes/photos.test.ts` | 既存 |
| text/html は 415。申告 MIME 偽装は magic 優先 | 同上 | **追加** |
| 他人の content / PATCH / DELETE は 404。未認証メタ 401 | 同上 | 既存 + **メタ 401 追加** |
| recognize 401 / 429 / 502 / 壊れた JSON / MIME | `src/server/routes/bottles-recognize.test.ts` | 4-07 |
| recognize HTML / 1MB / 長辺 / 申告 MIME 偽装 | 同上 | **追加** |

### 単体

| ケース | ファイル | 4-05 |
|---|---|---|
| 出力サイズの幅・高さが長辺上限以下 | `src/client/lib/photo/geometry.test.ts` | **追加**（`outputSizeForAspect` / `decodeOutputSize`） |
| ツールバー操作で一覧が絞られる | `src/client/lib/cellar-shelf.test.ts` | **追加** |
| 状態バッジ文言 | `src/client/lib/bottle-form.test.ts` | **追加** |
| Zod の drinkType=evil / status 未知キー | `src/shared/bottles.test.ts` | **追加** |

### コンポーネント

| ケース | ファイル | 4-05 |
|---|---|---|
| フィルタ UI（検索・種類・種類ごとで種類フィルタ非表示） | `src/client/components/cellar/CellarToolbar.test.ts` | **追加** |
| 状態バッジ・開栓 / 復元ボタン | `src/client/components/cellar/BottleDetail.test.ts` | **追加** |
| フォームの field-error と AI 印 | `src/client/components/cellar/BottleForm.test.ts` | **追加** |

## 9. 受け入れ条件

- [x] Phase 4 DoD のテスト文面を満たす（写真の他ユーザー 404、consume / restore / recognize の認可・上限）
- [x] CI グリーン（lint / typecheck / test）
- [x] High 以上の audit なし
- [x] 新機能を混ぜない

## 10. セキュリティ観点

- テストが「403 で存在漏洩」していないこと（期待は 404 / 未認証は 401）
- フィクスチャに実在するラベル写真（著作権）を使わない。生成画像または単色

## 11. 関連ファイル / 関連spec

- [02-bottle-crud.md](02-bottle-crud.md)
- [04-photo-upload-r2.md](04-photo-upload-r2.md)
- [07-label-recognition.md](07-label-recognition.md)
- [spec/features/cellar.md](../../spec/features/cellar.md) 4 / 8 / 9
- [.cursor/skills/security-audit/SKILL.md](../../.cursor/skills/security-audit/SKILL.md)

## 12. リスク・注意点

- R2 は `createTestApp()` のメモリバケット。wrangler / Miniflare は使わない（0-06 / 2-07 と同じ）
