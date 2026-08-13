# 4-05 セラー APIテスト・コンポーネントテスト

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | API に認可テスト、主要コンポーネントテスト |
| ソース | Phase 4「APIテスト・コンポーネントテスト」 |

## 1. 概要

4-02〜4-04 のテスト穴を塞ぎ、Phase 4 DoD を満たす。各機能 PR にテストが付いているのが本則。本タスクはギャップ埋めと一覧。

## 2. 前提条件

- ボトル CRUD、ステータス、写真の実装が main または同一ブランチにある
- Vitest + Testing Library（未導入なら本タスクで入れ、理由を PR に）

## 3. スコープ

**対象**

- API: CRUD、検索スコープ、401、404 統一、写真 MIME/サイズ、他人の写真
- コンポーネント: フィルタ、フォームバリデーション表示、ステータスバッジ
- CI グリーン

**対象外**

- Playwright E2E（Phase 6）
- 新機能

## 4. 成果物

- 不足テストの追加
- テスト一覧を cellar.md か本ファイル完了時にチェック済みとロードマップ更新

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

ギャップ例:

| ケース | 期待 |
|---|---|
| 未ログイン GET /api/bottles | 401 |
| B の bottle id を A が GET | 404 |
| B の bottle を A が PATCH | 404 |
| status=evil | 400 |
| content-type: text/html アップロード | 400 |
| A の署名 URL を B の Cookie で取り直し | 404 |

## 7. 仕様詳細

coding-standards: テストはソース隣。コンポーネントはユーザーイベントでフィルタが絞ることを見る。

写真バイナリは小さな 1x1 jpeg フィクスチャを git に入れてよい（秘密ではない）。

## 8. 受け入れ条件

- [ ] Phase 4 DoD のテスト文面を満たす
- [ ] CI グリーン
- [ ] High 以上の audit なし
- [ ] 新機能を混ぜない

## 9. セキュリティ観点

- テストが「403 で存在漏洩」していないこと（期待は 404）
- フィクスチャに実在するラベル写真（著作権）を使わない。生成画像または単色

## 10. 関連ファイル / 関連spec

- [02-bottle-crud.md](02-bottle-crud.md)
- [04-photo-upload-r2.md](04-photo-upload-r2.md)
- [.cursor/skills/security-audit/SKILL.md](../../.cursor/skills/security-audit/SKILL.md)

## 11. リスク・注意点

- R2 シミュレータなしでテストが skip だらけにしない。ローカルバインディングを CI でどうするか **要確認**（モック vs wrangler テスト）
