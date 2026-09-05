---
name: db-migration
description: alco-appのD1（SQLite）スキーマ変更手順。Drizzleスキーマを変更してマイグレーションを生成・ローカル適用・検証するとき、マイグレーションの取り消し（ロールバック）が必要なとき、Better Authのスキーマを再生成するときに使用する。
---

# D1 マイグレーション手順

正本は [spec/data-model.md](../../../spec/data-model.md)。制約は [`.cursor/rules/database.mdc`](../../rules/database.mdc)。
ここでは「スキーマを変えてから、ローカル D1 に反映し、テストで固定する」までの手順を定める。

## ファイル構成

| パス | 役割 |
|---|---|
| `src/shared/constants.ts` | `DRINK_TYPES` / `BOTTLE_STATUSES` / `PHOTO_KINDS`。DB の CHECK と Zod enum の共通ソース |
| `src/db/auth-schema.ts` | Better Auth CLI の生成物（`user` / `session` / `account` / `verification`）。**手で編集しない** |
| `src/db/schema.ts` | アプリ 6 テーブル（`drink_logs` / `my_drinks` / `bottles` / `tasting_notes` / `photos` / `ai_usage`）。`auth-schema.ts` を re-export する |
| `drizzle.config.ts` | drizzle-kit 設定。`out` は `wrangler.jsonc` の `migrations_dir`（`src/db/migrations`）と一致させる |
| `src/db/migrations/*.sql` | 生成されたマイグレーション。wrangler がファイル名順に適用する |
| `src/db/migrations/meta/` | drizzle-kit の journal / snapshot。**必ずコミットする**（Biome の対象外） |
| `src/db/migrations.test.ts` | 全マイグレーションを `node:sqlite` に適用し、スキーマとの同期・制約の挙動を検証する |

## 手順チェックリスト

```
- [ ] 1. spec/data-model.md を先に更新し、オーナー承認を得る
- [ ] 2. src/shared → src/db/schema.ts の順で TypeScript を変更する
- [ ] 3. pnpm db:generate --name <内容> でマイグレーションを生成する
- [ ] 4. 生成 SQL を目で確認する（CHECK に `?` が残っていない、意図しない DROP がない）
- [ ] 5. pnpm db:migrate:local でローカル D1 に適用する
- [ ] 6. 確認クエリを叩く
- [ ] 7. pnpm test（migrations.test.ts が同期ズレを検知する）
- [ ] 8. 生成物（.sql と meta/）をコミットする
```

### 1. 仕様を先に変える

列の追加・削除・enum 値の変更は `spec/data-model.md` の該当表を先に更新する。範囲・文字数は Zod（`src/shared`）が正なので、DB CHECK は enum と写真の排他だけにとどめる。

### 2. スキーマを変更する

- 列名は snake_case、プロパティは camelCase で明示マッピングする
- 瞬間時刻は `integer(..., { mode: "timestamp_ms" })`、カレンダー日は `text` の `YYYY-MM-DD`
- 新しいアプリテーブルには必ず `user_id`（`user.id` へ `ON DELETE CASCADE`）を付ける
- CHECK にリテラルを埋め込むときは `schema.ts` の `inList()` を使う（drizzle-kit はバインド値を `?` のまま出力するため、`sql\`${値}\`` は使えない）

### 3. 生成する

```powershell
pnpm db:generate --name add_bottle_rating
```

`--name` を省くと drizzle-kit がランダムな名前（`0001_lying_storm.sql` など）を付ける。内容が分かる名前を付ける。
「No schema changes」と出た場合は TypeScript 側が変わっていない。

### 4. SQL を確認する

SQLite は `ALTER TABLE` が弱いため、列の型変更・NOT NULL 化・CHECK 変更は drizzle-kit が **テーブル再作成**（`__new_xxx` を作ってコピー → 旧テーブル DROP → RENAME）を出す。データが入っている環境に当てる前に、コピー時の `INSERT INTO ... SELECT` が全列を扱っているか確認する。

### 5. ローカル D1 に適用する

```powershell
pnpm db:migrate:local
```

これは `wrangler d1 migrations apply alco-app-dev --local --env dev` の別名。適用状態は `.wrangler/state/v3/d1` にあり、git 管理外。壊れたら `.wrangler/state` を消して再適用すればよい（ローカルのデータは消える）。

### 6. 確認クエリ

```powershell
pnpm exec wrangler d1 execute alco-app-dev --local --env dev --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
pnpm exec wrangler d1 execute alco-app-dev --local --env dev --command "PRAGMA table_info('bottles');"
```

`--command` に渡す SQL は固定文字列のみ。ユーザー入力を埋め込むスクリプトは作らない。

### 7. テスト

`src/db/migrations.test.ts` は次を自動検証する。

- journal の `tag` と `.sql` が 1:1、`idx` が連番
- `schema.ts` の全テーブルの列名・NOT NULL・インデックスが、マイグレーション適用後の DB と一致（generate 忘れ検知）
- アプリ全テーブルの `user_id` FK と CASCADE、enum CHECK、写真の所有者排他（3 列で最大 1 つ）、SET NULL / CASCADE の挙動

制約を足したら、その挙動のテストも同じ PR に追加する。

## ロールバック方針

**down マイグレーションは使わない。** D1 には安全なロールバック機構がなく、`d1_migrations` テーブルの適用履歴を手で書き換えると環境間でズレる。

| 状況 | 対応 |
|---|---|
| まだ commit / push していない | `.sql` と `meta/` の該当エントリを削除し、`.wrangler/state` を消してローカル D1 を作り直す（journal の最新エントリだけを消す。途中の番号を消さない） |
| main にマージ済み・リモート未適用 | 元に戻す内容の **新しい forward migration** を生成する（列を落とす／制約を戻す）。既存 SQL は書き換えない |
| リモート（dev / 本番）に適用済み | 同上。加えてデータ移行が必要なら SQL に `UPDATE` を含めて生成 SQL を補う。D1 Time Travel での復旧は Phase 7 の運用手順（`spec/operations.md`）に従う |

## リモート適用

2-01 の範囲では **リモートに適用しない**。dev リモートは Phase 3-07、本番は Phase 7-01 で手順を決める。`--remote` を付けるコマンドをこの skill に増やすときはオーナー承認を得る。

## Better Auth スキーマの再生成

`src/db/auth-schema.ts` は Better Auth CLI の出力。プラグイン追加や Better Auth のメジャーアップデートで列が増えたら CLI で再生成し、差分を drizzle-kit で forward migration にする。

```powershell
pnpm dlx @better-auth/cli@latest generate --config src/server/auth.ts --output src/db/auth-schema.ts -y
pnpm format
pnpm db:generate --name better_auth_update
```

- 2-01 時点では `src/server/auth.ts` が無いため、`drizzleAdapter({}, { provider: "sqlite" })` + `emailAndPassword` の最小設定で生成した（better-auth 1.7.2 / CLI 1.4.21）。2-02 で実設定に置き換えたら再生成して差分がないことを確認する
- 生成物の列を手で減らさない。`account.password` はアプリから SELECT しない
- `usePlural` は使わない（テーブル名はライブラリ既定の単数形）

## 禁止

- 共有 D1 への手書き `CREATE` / `ALTER`
- 適用済み `.sql` の書き換え
- マイグレーション・シードへのパスワードやトークンの埋め込み
- `wrangler d1 execute` へのユーザー入力の受け渡し
