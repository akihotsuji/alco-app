# 0-05 TypeScript strict設定、Biome導入

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 0 プロジェクト基盤 |
| ステータス | **完了**（2026-09-03。`pnpm typecheck` / `pnpm lint` がパス） |
| 要件 | 保守性: TypeScript strict、自動 lint（[spec/01-requirements.md](../../spec/01-requirements.md)、[spec/02-tech-stack.md](../../spec/02-tech-stack.md)） |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 1. 概要

型とフォーマットを機械的に固定し、エージェントの実装ミスを CI で止める。ESLint + Prettier は使わず **Biome 1 本**。

## 2. 前提条件

- 0-04 で `package.json` と `tsconfig` の骨格がある
- 0-02 の Node / pnpm

## 3. スコープ

**対象**

- `tsconfig` の `strict: true`（関連フラグも緩めない）
- Biome（lint / format）
- `pnpm lint` / `pnpm format` / `pnpm typecheck` スクリプト
- エディタ用の最低限設定（任意: `biome.json` のみでよい）

**対象外**

- Vitest（0-06）
- CI ワークフロー本体（0-07。本タスクの script 名を CI が呼ぶ）
- `any` 禁止などの運用ルール（`.cursor/rules/coding-standards.mdc` に既存）

## 4. 成果物

- `tsconfig.json`（単一。`tsconfig.client.json` / `tsconfig.server.json` は作らない）
- `biome.json`
- `worker-configuration.d.ts`（`wrangler types --env dev`）
- package.json scripts
- 初回 `pnpm biome check --write .` 適用済みのソース

## 5. 細分化タスク

1. TypeScript を devDependency に入れる（未導入なら）
2. `compilerOptions` を strict にする。`skipLibCheck` はライブラリ型のため許可してよい
3. Biome を入れ、`biome.json` で `src/` を対象、`dist` と `.wrangler` を除外
4. scripts: `"typecheck": "tsc --noEmit"`、`"lint": "biome check ."`、`"format": "biome check --write ."`
5. ローカルで lint / typecheck がパスすることを確認する

## 6. 手順

```powershell
pnpm add -D typescript biome
```

Biome パッケージ名は導入時点の公式（`@biomejs/biome`）に従う。

`tsconfig.json` で少なくとも:

- `strict`: true
- `noUncheckedIndexedAccess`: **要確認**（推奨 true。既存コードが無い今が入れ時）
- `jsx`: react-jsx
- `moduleResolution`: bundler
- パスエイリアス `@/` を使うかは **要確認**。使うなら Vite と tsconfig の両方に書く

`biome.json` の方針:

- インデント・引用符はプロジェクトで一度決めて変えない
- `organizeImports` を有効にして import 順の差分を減らす

実行:

```powershell
pnpm typecheck
pnpm lint
```

失敗はソースを直す。ルールを緩めてパスさせない。

## 7. 仕様詳細

[coding-standards](../../.cursor/rules/coding-standards.mdc):

- `any` と根拠のない `as` 禁止
- 外部入力は Zod（Phase 2 以降）

React の `react-jsx`、Workers の型（`@cloudflare/workers-types`）を `compilerOptions.types` または tsconfig の `types` で入れる。**要確認**: wrangler 生成の `worker-configuration.d.ts` を使うか。

除外:

- `spec/` の Markdown は Biome 対象外でよい
- `roadmap/` も対象外

## 8. 受け入れ条件

- [x] `strict: true` が有効
- [x] `pnpm typecheck` がパス
- [x] `pnpm lint` がパス
- [x] format 用 script がある
- [x] ESLint/Prettier を追加していない
- [x] 関連 spec / 本手順とディレクトリが一致

セキュリティ監査: 設定のみなら Critical なしを確認。シークレットを tsconfig に書かない。

## 9. セキュリティ観点

- lint で `dangerouslySetInnerHTML` を機械検出までは求めない（レビューと security-audit）
- 生成された型ファイルに秘密を埋め込まない

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- [.cursor/rules/coding-standards.mdc](../../.cursor/rules/coding-standards.mdc)
- 次: [06-vitest.md](06-vitest.md)

## 11. リスク・注意点

- client と worker で `lib` / `types` が衝突する。必要なら tsconfig を分割する
- Biome と Tailwind クラスの長い行で wrap が荒れうる。1 行長の上限は現実的な値にする
- 後から `noUncheckedIndexedAccess` を入れると差分が大きい。今入れる

## 12. FIX（0-05）

正本は [spec/02-tech-stack.md](../../spec/02-tech-stack.md) の「TypeScript / Biome」。

| 項目 | 決定 |
|---|---|
| tsconfig | **単一**で開始。0-05 時点では DOM + Workers 型の衝突なし |
| `noUncheckedIndexedAccess` | **true** |
| パスエイリアス | `@/` → `src/`（tsconfig `paths` と Vite `resolve.alias`） |
| Workers 型 | `worker-configuration.d.ts`（`pnpm cf-typegen` = `wrangler types --env dev`）。`@cloudflare/workers-types` は入れない |
| Biome | `@biomejs/biome` 2.x。対象は `src/` とルート設定。`spec/` / `roadmap/` / `dist` / `.wrangler` / 生成型は除外 |
| フォーマット | 2 スペース、二重引用符、セミコロンあり、行長 100、`organizeImports` on |
| scripts | `typecheck` / `lint` / `format` / `cf-typegen` |
| エディタ | `biome.json` のみ（`.vscode` は作らない） |
