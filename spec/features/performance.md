# パフォーマンス（初回表示・記録操作）

実装: Phase 6-03。要件は [01-requirements.md](../01-requirements.md) 非機能「パフォーマンス」、手順は [roadmap/phase-06-pwa-quality/03-performance.md](../../roadmap/phase-06-pwa-quality/03-performance.md)。Lighthouse a11y は [04-accessibility](../../roadmap/phase-06-pwa-quality/04-accessibility.md)（6-04）。

- 状態: **本 PR で追加**（6-03 実行。Lighthouse CI は入れない）
- 点数は変動する。根拠は日付付きで本ファイルと PR に残す

---

## 1. 目的

本番相当ビルドで初回表示と記録操作を要件内に収める。推測でライブラリは足さない。計測してから直す。

| 項目 | 目標 |
|---|---|
| 初回表示 | 3 秒以内（4G 想定） |
| 記録操作 | 保存完了まで 1 秒以内（体感。D1 往復を増やさない） |
| Lighthouse モバイル | Performance / Best Practices 目安 80+（Phase 6 DoD） |

---

## 2. 方針（6-03 の確定）

| 項目 | 決定 | 理由 |
|---|---|---|
| 計測ルート | 本番相当ビルド。計測専用ルートは作らない | ログイン画面と、セッション後のホームを測る。認証壁を外さない |
| Lighthouse CI | **入れない**（MVP は手動 + 本ファイルの記録） | 無料枠・フレーク。要確認は「手動で可」 |
| 楽観的更新 | **しない** | 誤記録リスク。`query-client` の staleTime 30s と mutation 後の invalidate で足りる |
| チャート | 自前 SVG のまま。サマリー chunk だけが読む | 追加ライブラリを足さない |
| フォント | システムフォントのまま | 既に `--font-sans` が system-ui / ヒラギノ。自己ホストも CDN も足さない |
| lucide | 名前付き import のまま | バレル全体 import はしない |
| バンドル分析 UI | 本番に残さない。`rollup-plugin-visualizer` は入れない | `pnpm build` の chunk 一覧で足りる |
| CSP | 緩めない | Best Practices と性能のために `unsafe-inline` 等を足さない |
| ONNX / WASM | 使ったときだけ dynamic import（既存） | 初回バンドルに載せない |

---

## 3. コード分割

初期 JS はシェル（認証・Query・下部タブ・トースト）だけ。画面はルート単位の `React.lazy`。

| chunk | 対象 |
|---|---|
| `shell` | 認証後レイアウト（タブ・写真編集コンテキスト・初回ガイド） |
| `home` | `/` |
| `login` / `signup` | `/login` `/signup` |
| `summary` | `/summary/week` `/summary/month`（チャートを含む） |
| `logDay` | `/logs` `/logs/:date` |
| `logForm` | `/logs/new` `/logs/entries/:id/edit` |
| `myDrinks` | `/logs/my-drinks` 配下 |
| `cellar` | `/cellar` 配下 |
| `notes` | `/notes` 配下 |
| `settings` | `/settings` |
| `notFound` | `*` |
| `photoEdit` | `photo-edit` オーバーレイ。`open` のときだけ読む |

チャンク待ちの fallback は既存の `AuthBoot`（ゲスト）と `CardSkeleton`（認証後の Outlet）。タブバーはサスペンドしない。

先読み:

- 起動直後: `boot-prefetch.ts` を **別エントリ**（本番は main より前の `<script type="module">`）として読む。メイン JS の解析を待たず、**開いたパス**の chunk を `import()` する（`/login` なら login だけ。`/` なら shell + home）。セッション Cookie は httpOnly なので JS からは見ない
- 同じ script が `GET /api/auth/get-session` と、ゲスト専用画面（`/login` `/signup` `/forgot-password` `/reset-password`）以外では `GET /api/me` を **並行して**先に飛ばす。`/` ではホームが待つ summary（day/week）と my-drinks、`/cellar` では棚の 1 ページ目（保存済みの表示形式と画面幅から limit を決める。種類ごとなら `limit=1` の meta）、`/notes` では一覧の 1 ページ目も先に飛ばし、Hono RPC / Better Auth が応答を使い切る（楽観的更新ではない）。検索・種類・評価のフィルタが URL にあるときは一覧を先読みしない
- 認証後シェル（`AppShellFrame`）は描画が落ち着いた **300 ms 後の idle** に、下部タブの初期一覧（ホームの summary / my-drinks、セラーの 1 ページ目、ノートの 1 ページ目）を `prefetchQuery` / `prefetchInfiniteQuery` で先読みする（`use-tab-data-prefetch.ts`）。各画面の hook と同じ `queryOptions` を使うのでキーが一致し、タブを開いた瞬間にキャッシュが当たる。すでにキャッシュ（取得中を含む）がある query は触らない
- 先読み GET は 10 秒で打ち切る。失敗した Promise を本バンドルが待たず、通常の `fetch` にフォールバックする。画面 `import()` の失敗は握りつぶして未処理拒否にしない（本体の Error Boundary / `vite:preloadError` が復旧する）
- タブ / FAB / ヘッダー / ホームの導線: `pointerenter` と `focus` で行き先の chunk を先読み
- 中央タブ「記録」は `logForm` と `photoEdit`

---

## 4. 画像

ユーザー写真の `<img>` は `ContentPhoto` だけを使う。

| 場所 | loading | 寸法（CSS と一致） |
|---|---|---|
| 一覧・棚・ピッカー・日別サムネ | `lazy` | 日別 48×48、棚 100×150、ピッカー 40×60、ノートカード 160×200 |
| 詳細ヒーロー・カルーセル先頭・編集中プレビュー・ライトボックス | `eager` | ヒーロー 160×240（長方形写真は 160×300）、タイル 96×120 / 100×150 |

`decoding="async"`。切り抜きの背後に白は敷かない（既存）。同一オリジン GET なので Cookie が付く。

到着の見せ方（00-common 2.5 / M-29 の写真版）:

- `ContentPhoto` は `data-state="loading|loaded"` を持つ。`loading` は不透明 0、`loaded` で 0 → 1 を `--dur-state`。`load` / `error` のどちらでも `loaded` にする（透明のまま残さない）。ブラウザキャッシュに乗っていて `complete` なら最初から `loaded`（動かない）
- 棚タイルは写真到着まで **種類のボトル型**（`BottleSilhouette`）を背後に置き、到着で写真とクロスフェード。ノートカードは inset の枠（スケルトンと同じ静止表現）。シマー・点滅はしない
- 配信は `Cache-Control: private, max-age=31536000, immutable` + `ETag`（[photos.md](photos.md)）。写真は差し替え不可で ID が変わるため、2 回目以降はネットワークに出ない

---

## 5. 記録操作 1 秒

- 保存 API の往復後に `drinkLogs` / `drinkLogSummaries` を invalidate する（既存）。余分な refetch は足さない
- 楽観的更新はしない
- 記録フォーム chunk は中央タブホバーで先読みし、タップ後の待ちを短くする

---

## 6. 計測結果

環境: `pnpm build`（本番相当クライアント）。日付は JST。Lighthouse はモバイルプリセット。認証後は計測用ルートを作らず、サインアップ後の `/` を測る。

### 6.1 バンドル（修正前・2026-09-08）

| ファイル | raw | gzip |
|---|---:|---:|
| `assets/index-*.js`（単一エントリ） | 749.56 kB | 234.13 kB |
| `assets/index-*.css` | 82.89 kB | 14.85 kB |
| `onnxruntime`（既存の dynamic） | 45.40 kB | 14.70 kB |

Vite が 500 kB 超を警告。ボトルネックは **初期 JS 1 本に全画面が入っていること**。画像 CDN・有料プランは対象外。

### 6.2 バンドル（修正後・2026-09-09 JST）

`pnpm build` の Vite 表示。初期 HTML は `bootPrefetch` と `main` の 2 本の module と、main の静的 import 向け `modulepreload`。

| ファイル | raw | gzip | 役割 |
|---|---:|---:|---|
| `assets/bootPrefetch-*.js` | 5.06 kB | 2.11 kB | 起動専用。パスの画面 chunk と初回 GET を先に取る |
| `assets/main-*.js` | 203.72 kB | 64.01 kB | React 起動・Router・Query。修正前の単一エントリ 749.56 / 234.13 |
| 共有 `early-fetch-*.js`（Vite 命名。実体は React / Zod 等） | 126.66 kB | 39.20 kB | main と画面 chunk の共有 |
| `auth-client-*.js` | 27.00 kB | 9.99 kB | Better Auth クライアント |
| `api-*.js` | 21.09 kB | 7.68 kB | Hono RPC クライアント |
| `AuthenticatedLayout-*.js` | 16.43 kB | 5.64 kB | 認証後タブ・写真コンテキスト |
| `HomePage-*.js` | 9.24 kB | 3.41 kB | ホーム |
| `LoginPage-*.js` | 1.59 kB | 0.92 kB | ログイン |
| `LogFormPage-*.js` | 15.29 kB | 5.65 kB | 記録フォーム |
| `CellarPages-*.js` | 44.03 kB | 14.63 kB | セラー |
| `NotePages-*.js` | 35.25 kB | 11.62 kB | ノート |
| `SummaryPages-*.js` | 4.85 kB | 1.91 kB | 週/月サマリー＋チャート |
| `PhotoEdit-*.js` | 6.82 kB | 2.98 kB | 写真編集 UI |
| `process-*.js` | 25.46 kB | 9.30 kB | 切り抜き・合成（編集時。色補正はしない） |
| `onnxruntime` | 45.40 kB | 14.70 kB | 使ったときだけ（既存） |
| `assets/main-*.css` | 82.89 kB | 14.85 kB | 全画面 CSS |

初期 HTML が読む JS 合計は raw 約 400 kB / gzip 約 130 kB。単一エントリ 749.56 / 234.13 から **gzip 約 45% 減**。500 kB 警告は解消。分割のファイル数は増えたが、`bootPrefetch`（gzip 2 kB）が main の解析を待たずに画面 chunk と GET を始められる。

### 6.3 Lighthouse モバイル（修正後・2026-09-09 JST）

環境: `pnpm build` 済みクライアントを `wrangler dev --local`（127.0.0.1:8787）。Lighthouse 12.8.2、モバイルプリセット、各 3 回。認証後は計測用ルートを作らず、サインアップ後の Cookie を `--extra-headers` で付けて `/` を測った。

| 画面 | Performance | Best Practices | 備考 |
|---|---:|---:|---|
| `/login`（未ログイン） | **94**（3 回とも） | **96**（3 回とも） | LCP 2.6s（ログイン見出し）。FCP 2.4s |
| `/`（ログイン後ホーム） | **85**（3 回とも） | **93**（3 回とも） | LCP 3.7s（`p.home-mydrinks-empty`）。FCP 2.8s。TBT 0 |

目安 80 は両画面で達成。ホーム LCP の Render Delay は約 88%（空状態文言は API 後に出る。画面設計は変えない）。Best Practices の減点は既存どおり Radix Dialog の inline style が CSP `style-src 'self'` に当たる件。CSP は緩めない。

開発モードの点数は使わない。

### 6.4 API 応答時間と D1 往復（2026-09-10 JST）

きっかけ: 実機でセラータブを開くと、ボトル写真が約 2 秒空白のままだった（読み込み表示なし）。Workers Observability（`alco-app-prod`、直近 7 日、`wallTimeMs` の p50）:

| エンドポイント | p50 | 備考 |
|---|---:|---|
| `GET /api/config` | 2 ms | D1 を触らない。ネットワーク外の基準 |
| `GET /api/auth/get-session` | 375 ms | session + user を 1 クエリ |
| `GET /api/me` | 545 ms | 認証 1 往復 + `age_verifications` 1 往復 |
| `GET /api/drink-logs/summary` / `my-drinks` | 722 ms | 認証 + 年齢 + 本体 |
| `GET /api/tasting-notes` | 781 ms | 同上 |
| `GET /api/bottles` | 874 ms | 同上 + 種類別件数 |
| `GET /api/photos/:id/content` | 991 ms（p95 1523 ms） | 認証 + 年齢 + `photos` SELECT + R2 の **直列 4 往復** |

`cpuTimeMs` は 5〜12 ms。差はすべて I/O 待ちで、**D1 1 往復 ≈ 220〜250 ms** が根本原因（Worker と D1 の距離）。1 リクエストが認証・年齢確認・本体の 3 往復以上を直列に踏み、写真はさらに R2 を待つ。

決定（本 PR）:

| 対策 | 内容 | 効果の見立て |
|---|---|---|
| セッションの Cookie キャッシュ | Better Auth `session.cookieCache`（60 秒、compact）。[auth.md](auth.md) | 60 秒以内の連続 API で認証の D1 往復が消える |
| 年齢確認の肯定キャッシュ | isolate 内で「確認済み userId」を最大 1000 件覚える。[age-verification.md](age-verification.md) | 同じ isolate に当たる 2 回目以降で 1 往復が消える |
| 写真の長期キャッシュ | `private, max-age=31536000, immutable` + `ETag` / 304。[photos.md](photos.md) | 2 回目以降はネットワークに出ない。並ぶ写真が一斉に出る |
| 起動・待機時の先読み | 3 章「先読み」 | タブを開いた瞬間にキャッシュが当たる |
| query の保持 24 時間 | `gcTime` を 24 時間に延長（`staleTime` 30 秒はそのまま） | 5 分以上ぶりのタブ切替でもスケルトンに戻らず、古い一覧を即描いて裏で取り直す |
| 写真のプレースホルダ | 4 章「到着の見せ方」 | 初回でも「空白」ではなく「読み込み中」に見える |

対象外（フォローアップ）:

- **Smart Placement**: `run_worker_first: true` のため Worker が D1 側へ寄るとアセット配信が遠くなる。効果は D1 の所在（`wrangler d1 info`）を見てから判断する
- D1 のリージョン移設（作り直しになる）
- 写真のサムネイル派生（R2 書き込み 2 倍。まずキャッシュで様子を見る）

---

## 7. 対象外

- インフラの有料プラン、画像 CDN 新規契約
- Lighthouse CI
- オフライン記録
- CSP の緩和
- a11y 80 点（6-04）
- Worker サーバーバンドルの分割

---

## 8. セキュリティ

- 先読みはパスだけ見る。セッション Cookie（httpOnly）を読まない・ログに出さない
- 計測拡張を本番バンドルに残さない
- 既存の認可・CSP・`/api/*` NetworkOnly は変えない
- 先読みの query は各画面の hook と同じ `queryOptions` を通る（認可は API 側。クライアントは `userId` を送らない）。query キャッシュは `RequireAuth` がゲストになった時点で `clear()` するので、24 時間保持でも他ユーザーの応答が残らない
- 写真の `ETag` は photoId（既にクライアントが URL で知っている値）。他人の写真は `If-None-Match` が一致しても認可を先に見て 404

---

## 9. 受け入れ

- [x] 主要ルートが分割されている
- [x] 一覧写真に遅延読み込みと寸法がある
- [x] 楽観的更新を入れていない
- [x] Lighthouse モバイル Performance / Best Practices が目安 80+（根拠を 6 章に残す）
- [x] lint / typecheck / test
- [x] 監査: CSP を緩めていない。計測用ルートを足していない
