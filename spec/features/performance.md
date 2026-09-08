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
- 同じ script が `GET /api/auth/get-session` を先に飛ばす。`/` ではホームが待つ summary（day/week）と my-drinks も先に飛ばし、Hono RPC / Better Auth が応答を使い切る（楽観的更新ではない）
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

### 6.2 バンドル（修正後・2026-09-08）

| ファイル | raw | gzip | 役割 |
|---|---:|---:|---|
| `assets/index-*.js`（エントリ） | 449.01 kB | 142.15 kB | シェル共通（React / 認証 / Query）。修正前 749.56 / 234.13 |
| `AuthenticatedLayout-*.js` | 16.09 kB | 5.53 kB | 認証後タブ・写真コンテキスト |
| `HomePage-*.js` | 9.03 kB | 3.31 kB | ホーム |
| `LoginPage-*.js` | 1.46 kB | 0.86 kB | ログイン |
| `LogFormPage-*.js` | 15.15 kB | 5.63 kB | 記録フォーム |
| `CellarPages-*.js` | 43.87 kB | 14.61 kB | セラー |
| `NotePages-*.js` | 35.11 kB | 11.58 kB | ノート |
| `SummaryPages-*.js` | 4.78 kB | 1.88 kB | 週/月サマリー＋チャート |
| `PhotoEdit-*.js` | 6.67 kB | 2.90 kB | 写真編集 UI |
| `process-*.js` | 25.37 kB | 9.25 kB | 切り抜き・色補正（編集時） |
| `onnxruntime` | 45.40 kB | 14.70 kB | 使ったときだけ（既存） |
| `assets/index-*.css` | 82.89 kB | 14.85 kB | 全画面 CSS |

初期エントリは **gzip 234 → 142 kB（約 39% 減）**。500 kB 警告は解消。

### 6.3 Lighthouse モバイル（修正後・2026-09-08）

| 画面 | Performance | Best Practices | 備考 |
|---|---:|---:|---|
| `/login`（未ログイン） | （計測後） | （計測後） | 3 回平均 |
| `/`（ログイン後ホーム） | （計測後） | （計測後） | 3 回平均。認証 Cookie 付き |

開発モードの点数は使わない。

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

---

## 9. 受け入れ

- [ ] 主要ルートが分割されている
- [ ] 一覧写真に遅延読み込みと寸法がある
- [ ] 楽観的更新を入れていない
- [ ] Lighthouse モバイル Performance / Best Practices が目安 80+（根拠を 6 章に残す）
- [ ] lint / typecheck / test
- [ ] 監査: CSP を緩めていない。計測用ルートを足していない
