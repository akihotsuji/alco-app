# PWA（ホーム画面追加・スタンドアロン）

実装: Phase 6-01。要件は [01-requirements.md](../01-requirements.md) 非機能「PWA」、技術は [02-tech-stack.md](../02-tech-stack.md)、手順は [roadmap/phase-06-pwa-quality/01-vite-plugin-pwa.md](../../roadmap/phase-06-pwa-quality/01-vite-plugin-pwa.md)。アイコンの見た目は [character.md](../character.md)、色は [design-system.md](../design-system.md)。

- 状態: **本 PR で追加**（6-01 実行。表示名は仮称のまま）
- 実機でのホーム追加確認は 6-05。本タスクはビルド成果とデスクトップ Chrome の installability

---

## 1. 目的

ホーム画面に追加すると、ブラウザのタブバーが無いスタンドアロンで起動する。オフライン記録・Background Sync・プッシュは作らない。

---

## 2. 表示名（6-01 の仮決め）

正式名称は未決。既存のログイン L2・設定の版表記に合わせる。

| 項目 | 値 | 理由 |
|---|---|---|
| `name` | `alco-app` | ワードマークと同じ。インストール一覧・スプラッシュで使う |
| `short_name` | `alco` | ホームアイコン下。12 文字前後を超えない短い英字 |
| `lang` | `ja` | UI が日本語 |
| `description` | `お酒の記録・セラー・テイスティングノート` | 誘飲にならない説明 |

変更するときは本ファイルと `src/shared/pwa.ts` を同じ PR で直す。

---

## 3. Web App Manifest

ビルド成果の `/manifest.webmanifest`（`vite-plugin-pwa` が生成）。

| キー | 値 |
|---|---|
| `name` | `alco-app` |
| `short_name` | `alco` |
| `start_url` | `/`（未ログインなら既存の認証境界で `/login` へ） |
| `scope` | `/` |
| `display` | `standalone` |
| `theme_color` | ライトのヘッダー色（地）`#E6E0D6` |
| `background_color` | 同じ `#E6E0D6`（スプラッシュの地。アイコンの primary 塗りとは別） |
| `icons` | 192 / 512（`any`）と 512（`maskable`）。PNG |
| `id` | `/` |

`display: standalone` により、ホーム追加後は OS / ブラウザのタブバーが消える。アプリ内の下部タブだけが残る（二重にならない）。確認手順は README。

---

## 4. テーマカラー

ヘッダー色は design-system の `--background`（ニューモーフィズムでヘッダーも地と同じ）。

| 経路 | ライト | ダーク |
|---|---|---|
| 初回描画（`index.html` の `theme-color` + `prefers-color-scheme`） | `#E6E0D6` | `#2C2926` |
| JS 後（設定「外観」で解決した `data-theme`） | 同上 | 同上 |

設定でライト／ダークを固定したときは、OS の `prefers-color-scheme` より解決済みテーマを優先する（`theme.ts` が `theme-color` を更新）。

アイコンの塗りはテーマ追従しない（後述）。マニフェストの `theme_color` は単一値のためライトの地を書く。

---

## 5. アイコン

ラスタ PNG はリポジトリに置かない。ビルド時（と `pnpm dev` 起動時）に生成して `public/pwa/` へ書く（gitignore）。

| 項目 | 値 |
|---|---|
| ソース | [mascot-default.svg](../assets/character/mascot-default.svg)（通常ポーズ） |
| 地 | ライトの `--primary` `#7A3538` の正方形（角丸は OS が付ける。ソースに焼き込まない） |
| 線 | ライトの `--primary-fg` `#FFF8F4`（primary 地でグラス輪郭が見えるようにする） |
| 配置 | 高さ = キャンバスの 62%（マスク可能のセーフゾーン 80% に収める） |
| 出力 | `pwa-192x192.png` / `pwa-512x512.png`（`any`）、`pwa-512x512-maskable.png`（`maskable`）、`apple-touch-icon.png`（180） |

生成は `sharp`（`vite-plugin-pwa` の assets generator と同じエンジン）。合成（キャラ + primary 地 + 線色）を自前で固定するため generator のプリセットは使わない。

---

## 6. Service Worker

`vite-plugin-pwa` の `generateSW`。ファイル名 `sw.js`。登録はバンドル JS から `navigator.serviceWorker.register`（CSP の `script-src 'self'` を守るためインライン登録は使わない。`workbox-window` は足さない）。Cloudflare Vite の worker 環境には SW を出さない。

| 対象 | 戦略 | 理由 |
|---|---|---|
| ビルドした静的ファイル（HTML / JS / CSS / アイコン） | precache | スタンドアロン起動と再訪 |
| `/api/*`（認証・写真本文を含む） | **NetworkOnly** | セッション付き JSON / 認可付き画像を SW キャッシュしない |
| `/models/**` | precache **しない** | 4.5MB の ONNX。既存の Cache API が担う |

- `navigateFallback` は `index.html`（SPA）。`/api/` は denylist
- `registerType: autoUpdate` + `skipWaiting` + `clientsClaim`。デプロイ後は次の起動で新 SW がすぐ有効
- `pnpm dev`（Vite）では SW を登録しない（HMR と CSP 未適用のため）。確認は `pnpm build` → `wrangler dev --env dev`
- 古い SW が残って壊れたときの外し方は README

Workers Static Assets の `_headers` で `/sw.js` に `Cache-Control: no-cache` を付ける（デフォルトの must-revalidate でも再検証されるが、SW 更新を明示する）。

---

## 7. iOS / Apple

| 項目 | 値 |
|---|---|
| `apple-mobile-web-app-capable` / `mobile-web-app-capable` | `yes` |
| `apple-mobile-web-app-title` | `alco`（`short_name` と同じ） |
| `apple-mobile-web-app-status-bar-style` | `default`（`theme-color` に合わせる） |
| `apple-touch-icon` | `/pwa/apple-touch-icon.png` |

iOS の SW 対応は限定的。ホーム追加は manifest + Apple メタが主。実機確認は 6-05。

---

## 8. 対象外

- オフラインでの記録作成・編集・同期
- Background Sync / Periodic Background Sync
- プッシュ通知
- ストア申請
- iOS 向け `apple-touch-startup-image` の全解像度（スプラッシュは `background_color` + アイコン。不足は 6-05 で判断）

---

## 9. セキュリティ

- SW の scope はアプリ全体。配信は Workers の HTTPS のみ
- `/api/*` を CacheFirst / StaleWhileRevalidate にしない（Cookie 付き JSON・写真）
- SW 登録スクリプトを HTML インラインにしない（CSP）
- ログにセッショントークンを出さない（既存どおり）

---

## 10. 受け入れ

- [ ] ビルド成果に `manifest.webmanifest` があり、`display` が `standalone`
- [ ] 192 / 512 / maskable / Apple touch の PNG がある
- [ ] SW が `/api/` を NetworkOnly にし、`/models/` を precache しない
- [ ] lint / typecheck / test がパスする
- [ ] 監査: SW が秘密・認可レスポンスをキャッシュしない
