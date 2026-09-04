# 2-01 Drizzleスキーマ実装とマイグレーション運用

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **未着手** |
| 要件 | スキーマ駆動、D1 |
| ソース | Phase 2「Drizzleスキーマ実装とマイグレーション運用の確立（ローカルD1に適用）」 |

## 1. 概要

承認済み `spec/data-model.md` を Drizzle スキーマとマイグレーションにし、ローカル D1 に適用する手順を確立する。Better Auth 用テーブルも含める（2-02 と同一 PR でも分割でも可）。

## 2. 前提条件

- Phase 0 完了（wrangler、D1 バインディング）
- Phase 1-04 承認
- skill `db-migration` を本タスクで書いてよい

## 3. スコープ

**対象**

- `src/db/schema.ts`（分割可）
- drizzle-kit 設定
- 初回マイグレーション SQL
- ローカル D1 への apply
- 開発者向け手順（skill）

**対象外**

- 本番 apply（Phase 7）
- 画面
- シードデータ（任意。個人用デモデータは **要確認**）

## 4. 成果物

- `src/db/` 配下のスキーマと `migrations/`
- `drizzle.config.ts`
- `.cursor/skills/db-migration/SKILL.md`
- `.cursor/rules/database.mdc`（1-04 で作成済み。実装手順の追加があれば更新）
- package.json scripts: `db:generate` / `db:migrate:local`

## 5. 細分化タスク

1. `drizzle-orm` / `drizzle-kit` を追加する（PR に理由）
2. スキーマを data-model どおり TypeScript で定義する
3. `pnpm drizzle-kit generate` で SQL を出す
4. `wrangler d1 migrations apply <name> --local` で適用する
5. 適用確認のクエリを 1 本叩く
6. skill にロールバック方針を書く（D1 は down が弱いので「新しい migration で直す」が現実的）

## 6. 手順

実装順は feature-dev どおり shared の Zod enum を先にしてもよい。DB の enum 文字列と Zod を一致させる。

```powershell
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

`wrangler.jsonc` の `migrations_dir` と drizzle-kit の `out` を一致させる。

ローカル適用（データベース名は 0-03 で決めたもの）:

```powershell
pnpm exec wrangler d1 migrations apply alco-app-dev --local --env dev
pnpm exec wrangler d1 execute alco-app-dev --local --env dev --command "SELECT name FROM sqlite_master WHERE type='table';"
```

リモート apply は本タスクでは原則やらない（dev リモートは Phase 3-07）。

ブランチ: `feature/drizzle-schema`

## 7. 仕様詳細

- クエリは Drizzle ビルダーのみ。文字列結合 SQL 禁止
- `sql` テンプレートを使うときはプレースホルダ
- 列名: DB snake_case、Drizzle `camelCase` マッピング
- Better Auth のテーブルは公式スキーマを import または生成手順に従う。手で列を減らさない

**要確認**: マイグレーションの journal を git に含める（含めるべき）。

## 8. 受け入れ条件

- [ ] ローカル D1 にテーブルがある
- [ ] スキーマが data-model と一致
- [ ] generate/apply 手順が skill にある
- [ ] `pnpm typecheck` / lint / 既存テストがパス
- [ ] リモートの本番 DB を叩いていない
- [ ] security-audit: スキーマに秘密列なし

## 9. セキュリティ観点

- マイグレーションにシード管理者パスワードを埋め込まない
- `user_id` 列がアプリテーブルにある
- D1 の execute にユーザー入力を渡すスクリプトを作らない

## 10. 関連ファイル / 関連spec

- [spec/data-model.md](../../spec/data-model.md)（Phase 1 成果）
- [../phase-01-design/04-er-drizzle-schema.md](../phase-01-design/04-er-drizzle-schema.md)
- 次: [02-better-auth.md](02-better-auth.md)

## 11. リスク・注意点

- ローカルとリモートで migration 番号がずれると復旧が辛い。journal を必ずコミット
- Windows で drizzle-kit のパス区切り
- Auth テーブルとアプリ users の二重定義
