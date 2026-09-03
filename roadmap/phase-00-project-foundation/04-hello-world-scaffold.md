# 0-04 Vite + React + Hono + Cloudflare Workers の空プロジェクト

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 0 プロジェクト基盤 |
| ステータス | **完了**（2026-09-03。`pnpm dev` / `wrangler dev --env dev` で Hello World） |
| 要件 | [spec/02-tech-stack.md](../../spec/02-tech-stack.md) の全体像 |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 1. 概要

1 つの Worker が React SPA の静的ファイルと Hono API を配信する空アプリを作り、`wrangler dev` で Hello World を出す。Next.js は使わない。

## 2. 前提条件

- 0-01、0-02 完了
- 0-03 完了。D1/R2 は `wrangler.jsonc` の **`env.dev`** に書く（トップレベルに置かない）。Hello World だけなら D1 なしでも起動は可だが、本タスクでバインディングまで書く
- 既存の `spec/` と `.cursor/` を消さない（テンプレート生成物で上書きしない）

## 3. スコープ

**対象**

- `package.json`、pnpm lockfile
- `wrangler.jsonc`
- `src/client/` Hello World SPA
- `src/server/` Hono の `/api/health` 程度
- Vite ビルドが Worker の assets になる配線
- `.gitignore`（**作成済み**。本タスクでは上書きせず、`.dev.vars*` / `node_modules` / `dist` / `.wrangler` が残っていることを確認する）

**対象外**

- 認証、Drizzle、shadcn、PWA（後続フェーズ）
- TypeScript strict の締めと Biome（0-05 でも可。本タスクで `tsconfig` の骨格は置く）
- ビジネス画面

## 4. 成果物

[spec/02-tech-stack.md](../../spec/02-tech-stack.md) の構成に合わせる:

```
src/client/          # React SPA
src/server/          # Hono
src/db/              # 空でもディレクトリだけ
src/shared/          # 空でもディレクトリだけ
public/
wrangler.jsonc
vite.config.ts
package.json
.gitignore
```

- `GET /` で SPA の Hello World
- `GET /api/health` で JSON（例: `{ "ok": true }`）
- `pnpm` scripts: `dev` / `build` / `preview` 相当

## 5. 細分化タスク

1. 既存ファイルを残したまま、Hono + Vite + Workers の公式に近いテンプレを調査する（上書き防止）
2. `.gitignore` は作成済み。内容を確認し、不足があれば追記する（ゼロから作り直さない）
3. ディレクトリと Hello World を実装する
4. `wrangler.jsonc` で Worker エントリと assets を繋ぎ、`env.dev` に D1 `DB` / R2 `PHOTOS` を書く（形は [03-cloudflare-dev-resources.md](03-cloudflare-dev-resources.md)）
5. `pnpm install` → `pnpm exec wrangler dev --env dev` で SPA と `/api/health` を確認する
6. ルート README に起動手順を書く

## 6. 手順

1. **調査**: Cloudflare Workers + Vite（assets）+ Hono の現行推奨を公式ドキュメントで確認する。テンプレを使う場合は一時ディレクトリに生成し、必要なファイルだけコピーする。`spec/` を消さない。

2. `.gitignore` はルートに作成済み。0-04 時点の最低限（`node_modules` / `dist` / `.wrangler` / `.dev.vars*` / `*.local` / `.DS_Store`）を満たしている。不足があれば追記する。

3. 依存の目安（バージョンは作成時の最新安定。追加理由を PR に書く）:

- `hono`
- `vite` / `react` / `react-dom`
- `wrangler`
- TypeScript 関連は 0-05 と分担可

4. サーバー骨格（イメージ。公開エンドポイントは health のみ、仕様に明記）:

- `src/server/index.ts` で Hono アプリ
- `/api/health` は認証なしでよい（公開。オーナー承認対象として spec か本ファイルに残す）
- それ以外の `/api/*` は後で認証 MW

5. クライアント: `src/client/main.tsx` が `#root` に「alco-app」と出す。React Router は **入れない**（Phase 2）。

6. 起動:

```powershell
pnpm install
pnpm exec wrangler dev --env dev
```

ブラウザで `/` と `/api/health` を確認する。

7. `engines` または `packageManager` を package.json に書き、0-02 のバージョンと揃える。

## 7. 仕様詳細

アーキテクチャ（正本は tech-stack）:

```
[ブラウザ] --HTTPS--> [Workers]
  ├─ 静的: Vite ビルド
  └─ Hono /api/*
```

**公開エンドポイント（このタスク）**

| 方法 | パス | 認証 | 備考 |
|---|---|---|---|
| GET | `/api/health` | なし | デプロイ確認用。本文に内部情報を出さない |

SPA のクライアントルーティングは後で React Router。Worker 側は未知パスを `index.html` にフォールバックする必要がある（設定方法は Vite/assets の現行 API に従う）。

**FIX（0-04）**

- 日常開発は `pnpm dev`（Vite + `@cloudflare/vite-plugin`）。プラグインが workerd を内蔵するため、Vite と wrangler の同時起動はしない
- React Router は 0-04 では入れない（Phase 2）
- 公開 `GET /api/health` の仕様: [spec/features/health.md](../../spec/features/health.md)

**FIX（0-03）**

- wrangler は `env.dev`。Worker 名は `alco-app-dev`
- 起動は `wrangler dev --env dev`

## 8. 受け入れ条件

- [x] `wrangler dev --env dev` で Hello World が表示される（Phase 0 DoD）
- [x] `/api/health` が JSON を返す（スタックトレースなし）
- [x] `.gitignore` に `.dev.vars` がある（`.dev.vars*` + `!.dev.vars.example`）
- [x] `spec/` と `.cursor/` が残っている
- [x] `pnpm-lock.yaml` がある
- [x] ディレクトリが tech-stack の予定と一致する

## 9. セキュリティ観点

- health 以外の API を認証なしで足さない
- health レスポンスにアカウント ID、バインディング内部名以外の秘密を出さない
- `wrangler.jsonc` に secret を書かない
- 生成テンプレにサンプル秘密鍵があれば削除する

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- [.cursor/rules/project-context.mdc](../../.cursor/rules/project-context.mdc)
- 次: [05-typescript-biome.md](05-typescript-biome.md)

## 11. リスク・注意点

- `npm create` 系がリポジトリルートを初期化すると既存 spec を壊す。コピー戦略を取る
- Windows パスと wrangler の互換は実機で確認する
- assets のフォールバックを忘れると React Router 導入後にディープリンクが 404 になる
