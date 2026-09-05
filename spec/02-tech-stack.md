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
| 写真ストレージ | Cloudflare R2 | 無料枠10GB・転送料無料。アップロード前にクライアント側で切り抜き・リサイズ・色補正・合成まで済ませ、加工後 1 枚だけ保存 |
| 画像処理 | **ブラウザ Canvas 2D**（`createImageBitmap` + `ctx.filter` + `toBlob`） | Workers で画像処理をしない（CPU 時間・無料枠）。Cloudflare Images / 外部 API は有料または依存増のため不採用。追加パッケージなし（2026-09-05） |
| 写真取り込み | `<input type="file" accept="image/*" capture>` | iOS / Android の PWA スタンドアロンで最も確実。`getUserMedia` は使わない |
| キャラクター | インライン SVG の React コンポーネント（`<Mascot />`） | テーマ追従・拡縮自由・追加依存なし。ラスタ画像は持たない（[character.md](character.md)） |
| 定期処理 | Workers **Cron Triggers**（`scheduled`） | 未紐付け写真の日次 GC、`ai_usage` の掃除。無料枠に含まれる |
| 背景除去（切り抜き） | ブラウザ WASM（候補 `@imgly/background-removal`。Apache-2.0） | セラーの棚に切り抜きボトルを立てる（2026-09-05 に MVP へ）。端末内処理でサーバー費用ゼロ。初回にモデル数十 MB を DL（Cache API に保存）。失敗時は長方形にフォールバック。追加依存の理由は 4-06 の PR に明記 |
| ラベル読み取り | **Cloudflare Workers AI**（Vision 対応の指示追従モデル。binding `AI`） | ボトルのラベル写真から銘柄名・生産者・年・種類などの候補を返す（2026-09-05 決定。セラーのみ）。無料枠（日次 Neurons）内。新ベンダー・鍵が不要で、写真が Cloudflare 外へ出ない。`LabelRecognizer` インターフェースで実装し、将来 **Gemini 等の外部 API** に差し替え可能にする（その場合は `wrangler secret` で鍵、外部送信の明記が必要） |
| PWA | vite-plugin-pwa | manifest / アイコン（キャラクター由来）/ スタンドアロン表示を宣言的に設定 |
| Lint / Format | Biome | ESLint+Prettierの2本立てを避け、1ツールで完結。高速で設定が少ない |
| テスト | Vitest (+ Testing Library) / Playwright | 単体・コンポーネントテストはVitest。主要導線のE2EスモークはPlaywright |
| CI/CD | GitHub Actions + wrangler | PRでlint/型チェック/テスト、mainマージで自動デプロイ |
| ローカル開発 | Vite + `@cloudflare/vite-plugin`（日常） / `wrangler dev --env dev`（ビルド後） | プラグインが workerd 上で Worker と SPA を同時に動かす。Vite と wrangler の二重起動はしない |

## 却下した選択肢

- **Next.js**: ユーザー意向により不採用。
- **Supabase**: 無料枠プロジェクトが1週間アクセスなしで一時停止する運用上の煩わしさがあり、Cloudflareに寄せた方が構成が単純。
- **バックエンド別言語（Go等）**: 型共有のメリットを失い、AIエージェントにとってもリポジトリが複雑になるため不採用。
- **モノレポ（pnpm workspaces等）**: 個人規模では過剰。単一パッケージ構成で始め、必要になったら分割する。
- **Cloudflare Images / Image Resizing**: 有料。写真は端末内で加工済みなので不要。
- **サーバー側の画像ライブラリ（sharp 等）**: Workers で動かない・重い。magic bytes と寸法ヘッダの読み取りだけを自前で行う。
- **remove.bg 等の背景除去 API**: 有料・外部送信。端末内 WASM で足りる。
- **Gemini / OpenAI Vision を最初から採用**: 精度は高いが鍵管理と外部送信が増える。まず Workers AI で始め、精度不足なら差し替える（設計は差し替え前提）。
- **端末内 OCR（Tesseract.js）**: ワインラベルの書体・レイアウトに弱い。
- **`getUserMedia` のカメラ UI**: PWA スタンドアロンでの権限・向き・解像度の差異が大きい。OS のカメラアプリに任せる `input[capture]` の方が確実。

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
| パスエイリアス | `@/` → `src/`。`tsconfig.json` の `paths` と `vite.alias.ts`（Vite / Vitest で共有。0-06） |
| Workers 型 | `wrangler types --env dev` が生成する `worker-configuration.d.ts` を `compilerOptions.types` に入れる。`@cloudflare/workers-types` は使わない |
| 型の再生成 | `wrangler.jsonc` 変更後は `pnpm cf-typegen`。生成ファイルはコミットする（中身は binding 名と runtime 型のみ。秘密は含めない） |
| Lint / Format | **Biome のみ**（ESLint / Prettier は入れない） |
| 対象 / 除外 | 対象は `src/` とルートの設定ファイル。`spec/`・`roadmap/`・`dist`・`.wrangler`・生成型ファイルは対象外 |
| フォーマット | インデント 2 スペース、二重引用符、セミコロンあり、行長 100、`organizeImports` 有効 |
| scripts | `pnpm typecheck`（`tsc --noEmit`）/ `pnpm lint`（`biome check .`）/ `pnpm format`（`biome check --write .`） |

## テスト（0-06 FIX）

| 項目 | 決定 |
|---|---|
| ランナー | **Vitest 5.x**（導入時の安定版。Vite 7 の peer を満たす。実行には Node >= 22.12。Testing Library / jsdom は入れない） |
| 設定 | `vitest.config.ts` を **Vite 設定と分離**。`@cloudflare/vite-plugin` をテスト時に読まない |
| パスエイリアス | `@/` → `src/`。`vite.alias.ts` の `srcAlias` を Vite と Vitest で共有。`tsconfig.json` の `paths` も同じ |
| 実行環境 | **Node**（`environment: "node"`）。Workers ハーネスは使わない |
| 配置 | `src/**/*.test.ts`（ソース隣。coding-standards どおり） |
| API テスト方針 | Hono の **`app.request()` を Node / Vitest で使う**。`cloudflare:test` / Miniflare / `@cloudflare/vitest-pool-workers` は使わない。D1 が必要になったらモックまたは local D1（Phase 2-07 で踏襲） |
| scripts | `pnpm test` = `vitest run`（CI 向け・非インタラクティブ）。`pnpm test:watch` = `vitest`（監視。CI には書かない） |
| globals | 使わない。`import { describe, expect, it } from "vitest"` |

## CI（0-07 FIX）

検証のみ。デプロイは Phase 7-02。正本は [roadmap/phase-00-project-foundation/07-github-actions-ci.md](../roadmap/phase-00-project-foundation/07-github-actions-ci.md)。

| 項目 | 決定 |
|---|---|
| ワークフロー | `.github/workflows/ci.yml`（1 ファイル） |
| 起動 | `pull_request` と `push` to `main` |
| Node | `.node-version`（22）。`actions/setup-node` の `node-version-file` |
| pnpm | `package.json` の `packageManager`（`pnpm@10.11.0`）。`pnpm/action-setup@v6`（pnpm 10 向け。`pnpm/setup` は v11+） |
| cache | `actions/setup-node` の `cache: pnpm` |
| install | `pnpm install --frozen-lockfile`（lockfile 不一致は失敗） |
| コマンド | `pnpm lint` / `pnpm typecheck` / `pnpm test` / OSV-Scanner（`pnpm-lock.yaml`） |
| audit | lockfile の既知脆弱性があれば失敗。npm の `/-/npm/v1/security/audits` は使わない（ソケットタイムアウトが多発するため）。例外を黙って無視しない |
| 権限 | `permissions.contents: read` のみ。`pull_request_target` は使わない |
| 禁止 | デプロイ、`CLOUDFLARE_API_TOKEN`、Better Auth secret の参照 |
| ジョブ名 | `lint / typecheck / test / audit`（ruleset の必須チェックには使わない。2026-09-04） |

## ブランチ運用（0-08 FIX）

正本は [roadmap/phase-00-project-foundation/08-branch-protection.md](../roadmap/phase-00-project-foundation/08-branch-protection.md)。

| 項目 | 決定 |
|---|---|
| 手段 | Repository ruleset `protect-main`（classic protection は使わない） |
| 定義 | [`.github/rulesets/protect-main.json`](../.github/rulesets/protect-main.json) |
| 対象 | デフォルトブランチ `main` |
| 禁止 | 直接 push、force push、`main` 削除 |
| 作業ブランチ | 切る直前に `git fetch origin main`。`git checkout -b feature/<内容> origin/main`（または `fix/`）。ローカル main / 未フェッチの origin から切らない |
| PR | 必須。承認 0 人 |
| マージ | merge / squash / rebase いずれも可 |
| 必須チェック | **なし**（2026-09-04）。CI は回すが ruleset では止めない |
| bypass | なし |
| 適用 | 2026-09-05 済み（id `22315799`）。エージェントトークンでは作成不可 |
| 可視性 | **public**（Free で ruleset を使う。private にするなら Pro） |

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

### 1-07 で増えるインフラ（2026-09-05）

新しいサービスは **増やさない**。既存の Workers / D1 / R2 の範囲で次を足す。

| 項目 | 内容 | 実装フェーズ |
|---|---|---|
| Cron Trigger | `wrangler.jsonc` の `triggers.crons`（例 `0 18 * * *` = JST 3:00）で `scheduled` ハンドラを日次実行。未紐付け写真の GC（R2 + D1）、`ai_usage` 掃除 | 2-08 |
| Workers AI binding | `wrangler.jsonc` に `"ai": { "binding": "AI" }`。`env.AI.run(model, input)`。dev / production で同じ binding 名。モデル名は `src/server/services/label-recognizer/` の定数 | 4-07 |
| R2 の利用量 | 記録にも写真が付くため増える。1 枚 ≦300KB × 1 日 2 枚 → 年 220MB。切り抜き WebP は同程度。無料枠 10GB で 40 年分 | — |
| Workers CPU | 画像はクライアント加工済み。サーバーは magic bytes / 寸法ヘッダ / R2 put と、AI 呼び出しの待ち（CPU 時間には数えられない） | 2-08 / 4-07 |
| 背景除去モデル | クライアントが初回に DL。同一オリジン `/models/` に置くか CDN かは 4-06 で決める（CDN なら CSP `connect-src` に追加） | 4-06 |
| 環境変数 | 追加なし（写真上限・AI 日次上限などは `src/shared` の定数） | — |
| PWA アイコン | キャラクター SVG からビルド時に PNG 一式を生成（`vite-plugin-pwa` の assets generator） | 6-01 |

## ランニングコスト見積り

| サービス | 無料枠 | 想定 |
|---|---|---|
| Workers | 10万リクエスト/日、Cron 含む | 個人利用では余裕。一般公開後も当面無料枠内 |
| Workers AI | 日次の無料 Neurons 枠（導入時点の値を 4-07 で確認） | ラベル読み取りは 1 本の登録につき 1 回。ユーザー日次上限 30 回で枠を守る。一般公開時は上限を見直す |
| D1 | 5GB・500万行読取/日 | テキスト中心のデータなので余裕 |
| R2 | 10GB保存 | 加工済み写真(〜300KB/枚)で3万枚以上。記録・ノート・セラーを合わせても個人利用で年 300MB 程度 |
| GitHub | Free | Actions無料枠 |
| 独自ドメイン | 約1,000〜2,000円/年（任意） | 当面は無料の `*.workers.dev` でも可 |

**合計: 0円/月**（独自ドメインを取る場合のみ年千円台）。画像処理を端末内に置いたことで、写真機能を足しても増えない。
