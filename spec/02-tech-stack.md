# 技術選定

選定方針: **Next.jsを使わない / シンプルで分かりやすい / 無料枠で運用できる / AIエージェントが扱いやすい（情報が豊富・型安全）**

## 全体像

Cloudflare上に「1つのWorker」としてデプロイする構成。HonoがAPIを担い、同じWorkerがReact SPAの静的ファイルも配信する。デプロイ対象が1つだけなので、構成・CI・運用がシンプルになる。

```
[スマートフォン(PWAブラウザ)]
        │ HTTPS
        ▼
[Cloudflare Workers]  ← 1つのWorkerにまとめてデプロイ
 ├─ 静的アセット配信: React SPA (Vite ビルド成果物)
 └─ Hono API (/api/*)
      ├─ Cloudflare D1 (SQLite) …… ユーザー・記録データ
      └─ Cloudflare R2 …………………… 写真ストレージ
```

## 採用技術と理由

| レイヤー | 技術 | 理由 |
|---|---|---|
| 言語 | TypeScript (strict) | フロント〜バック〜DBスキーマまで型を一気通貫させ、AIエージェントの実装ミスを型で検出する |
| バックエンド | Hono | 希望どおり。軽量・シンプルでCloudflare Workersのファーストクラス対応。RPCクライアント(`hc`)でフロントと型共有できる |
| フロントエンド | Vite + React SPA | Next.jsなしの構成で最も情報が多く安定。SPAで十分（SEO不要のログイン必須アプリ） |
| ルーティング(FE) | React Router (libraryモード) | シンプルで学習コスト・情報量の面で無難 |
| データ取得 | TanStack Query + Hono RPC | キャッシュ・再取得を任せられる。RPCでAPIの型がフロントに自動で届く |
| UI | Tailwind CSS + shadcn/ui | モバイルファーストのUIを高速に構築。コンポーネントがコードとして手元に残るので保守しやすい |
| バリデーション | Zod (+ @hono/zod-validator) | スキーマをクライアント/サーバーで共有。APIの入力検証を宣言的に書ける |
| DB | Cloudflare D1 (SQLite) | 無料枠5GB。個人〜小規模なら十分。SQLiteなのでローカル開発も容易 |
| ORM/マイグレーション | Drizzle ORM + drizzle-kit | 型安全なクエリとマイグレーション管理。D1公式対応 |
| 認証 | Better Auth | Hono + D1 + Drizzleで動作する。メール/パスワードから始めてOAuthを後付けできる |
| 写真ストレージ | Cloudflare R2 | 無料枠10GB・転送料無料。アップロード前にクライアント側でリサイズ |
| PWA | vite-plugin-pwa | manifest / アイコン / スタンドアロン表示を宣言的に設定 |
| Lint / Format | Biome | ESLint+Prettierの2本立てを避け、1ツールで完結。高速で設定が少ない |
| テスト | Vitest (+ Testing Library) / Playwright | 単体・コンポーネントテストはVitest。主要導線のE2EスモークはPlaywright |
| CI/CD | GitHub Actions + wrangler | PRでlint/型チェック/テスト、mainマージで自動デプロイ |
| ローカル開発 | Vite + `@cloudflare/vite-plugin`（日常） / `wrangler dev --env dev`（ビルド後） | プラグインが workerd 上で Worker と SPA を同時に動かす。Vite と wrangler の二重起動はしない |

## 却下した選択肢

- **Next.js**: ユーザー意向により不採用。
- **Supabase**: 無料枠プロジェクトが1週間アクセスなしで一時停止する運用上の煩わしさがあり、Cloudflareに寄せた方が構成が単純。
- **バックエンド別言語（Go等）**: 型共有のメリットを失い、AIエージェントにとってもリポジトリが複雑になるため不採用。
- **モノレポ（pnpm workspaces等）**: 個人規模では過剰。単一パッケージ構成で始め、必要になったら分割する。

## リポジトリ構成（予定）

```
alco-app/
├─ spec/                # 仕様・設計ドキュメント（本フォルダ）
├─ .cursor/
│  ├─ rules/            # AIエージェント向けプロジェクトルール
│  └─ skills/           # 開発ワークフロー用スキル
├─ src/
│  ├─ client/           # React SPA（画面・コンポーネント・hooks）
│  ├─ server/           # Hono API（routes・services・middleware）
│  ├─ db/               # Drizzleスキーマ・マイグレーション
│  └─ shared/           # クライアント/サーバー共有（Zodスキーマ・型・定数）
├─ e2e/                 # Playwright E2Eテスト
├─ public/              # 静的ファイル・PWAアイコン
├─ wrangler.jsonc       # Cloudflare Workers設定
└─ vite.config.ts
```

## TypeScript / Biome（0-05 FIX）

| 項目 | 決定 |
|---|---|
| tsconfig | **単一**。client / worker の型衝突が出たら分割する |
| strict | `strict: true`。`noUncheckedIndexedAccess` も **true**（後から入れると差分が大きい） |
| `skipLibCheck` | ライブラリ型のため許可 |
| パスエイリアス | `@/` → `src/`。`tsconfig.json` の `paths` と `vite.config.ts` の `resolve.alias` の両方に書く |
| Workers 型 | `wrangler types --env dev` が生成する `worker-configuration.d.ts` を `compilerOptions.types` に入れる。`@cloudflare/workers-types` は使わない |
| 型の再生成 | `wrangler.jsonc` 変更後は `pnpm cf-typegen`。生成ファイルはコミットする（中身は binding 名と runtime 型のみ。秘密は含めない） |
| Lint / Format | **Biome のみ**（ESLint / Prettier は入れない） |
| 対象 / 除外 | 対象は `src/` とルートの設定ファイル。`spec/`・`roadmap/`・`dist`・`.wrangler`・生成型ファイルは対象外 |
| フォーマット | インデント 2 スペース、二重引用符、セミコロンあり、行長 100、`organizeImports` 有効 |
| scripts | `pnpm typecheck`（`tsc --noEmit`）/ `pnpm lint`（`biome check .`）/ `pnpm format`（`biome check --write .`） |

## 環境（Cloudflare）

正本。ID・アカウント情報はここに書かない。`database_id` は 0-04 以降の `wrangler.jsonc` のみ。

| 項目 | 決定 |
|---|---|
| wrangler env | Phase 0 から **`env.dev`**。トップレベル（デフォルト env）を dev 扱いにしない。Phase 7 で `env.production` を追加 |
| コマンド | 日常は `pnpm dev`（内部で `CLOUDFLARE_ENV=dev`）。確認・デプロイは `wrangler dev --env dev` / `wrangler deploy --env dev`。本番は `--env production` |
| Worker 名（dev） | `alco-app-dev`（`env.dev.name`） |
| D1（dev） | 名前 `alco-app-dev`、binding **`DB`** |
| R2（dev） | 名前 `alco-app-photos-dev`、binding **`PHOTOS`**、非公開 |
| 本番リソース | Phase 7。名前は `alco-app-prod` / `alco-app-photos-prod` を予定 |

コードからは `env.DB` / `env.PHOTOS` で参照する。

## ランニングコスト見積り

| サービス | 無料枠 | 想定 |
|---|---|---|
| Workers | 10万リクエスト/日 | 個人利用では余裕。一般公開後も当面無料枠内 |
| D1 | 5GB・500万行読取/日 | テキスト中心のデータなので余裕 |
| R2 | 10GB保存 | リサイズ済み写真(〜300KB/枚)で3万枚以上 |
| GitHub | Free | プライベートリポジトリ・Actions無料枠 |
| 独自ドメイン | 約1,000〜2,000円/年（任意） | 当面は無料の `*.workers.dev` でも可 |

**合計: 0円/月**（独自ドメインを取る場合のみ年千円台）
