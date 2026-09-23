# PWA（ホーム画面追加・スタンドアロン）

実装: Phase 6-01。要件は [01-requirements.md](../01-requirements.md) 非機能「PWA」、技術は [02-tech-stack.md](../02-tech-stack.md)、手順は [roadmap/phase-06-pwa-quality/01-vite-plugin-pwa.md](../../roadmap/phase-06-pwa-quality/01-vite-plugin-pwa.md)。アイコンの見た目は [character.md](../character.md)、色は [design-system.md](../design-system.md)。

- 状態: **6-01 済み**（表示名は 酒のしおり。アイコン地はライトの地色。[custom-domain.md](custom-domain.md)）
- 実機でのホーム追加確認は 6-05（[qa-devices.md](../qa-devices.md)。手順は README）

---

## 1. 目的

ホーム画面に追加すると、ブラウザのタブバーが無いスタンドアロンで起動する。アイコンにはアプリ内通知の未読数をバッジで出す（6.2。アプリが動いている間の更新）。利用者がオンにした端末には、友達のお知らせをプッシュ通知で届け、閉じている間もバッジを更新する（6.3。段階 2。[web-push.md](web-push.md)）。オフライン記録・Background Sync は作らない。

---

## 2. 表示名

公開名称は **酒のしおり**。リポジトリ名 `alco-app` は変えない。ログイン L2 のワードマーク `alt`・設定の版表記・マニフェストが同じ値を使う。

| 項目 | 値 | 理由 |
|---|---|---|
| `name` | `酒のしおり` | ワードマークと同じ。インストール一覧・スプラッシュで使う |
| `short_name` | `酒のしおり` | ホームアイコン下。短い和名 |
| `lang` | `ja` | UI が日本語 |
| `description` | `お酒の記録・セラー・テイスティングノート` | 誘飲にならない説明 |

変更するときは本ファイルと `src/shared/pwa.ts` を同じ PR で直す。

---

## 3. Web App Manifest

ビルド成果の `/manifest.webmanifest`（`vite-plugin-pwa` が生成）。

| キー | 値 |
|---|---|
| `name` | `酒のしおり` |
| `short_name` | `酒のしおり` |
| `start_url` | `/`（未ログインなら既存の認証境界で `/login` へ） |
| `scope` | `/` |
| `display` | `standalone` |
| `theme_color` | ライトのヘッダー色（地）`#E6E0D6` |
| `background_color` | 同じ `#E6E0D6`（スプラッシュの地。アイコン地も同じクリーム） |
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
| 地 | ライトの `--background` `#E6E0D6` の正方形（角丸は OS が付ける。ソースに焼き込まない。primary 地だとワインと溶ける） |
| 線 | ライトの `--foreground` `#2B261F`（クリーム地でグラス輪郭が見える） |
| 配置 | 高さ = キャンバスの 62%（マスク可能のセーフゾーン 80% に収める） |
| 出力 | `pwa-192x192.png` / `pwa-512x512.png`（`any`）、`pwa-512x512-maskable.png`（`maskable`）、`apple-touch-icon.png`（180） |

生成は `sharp`（`vite-plugin-pwa` の assets generator と同じエンジン）。合成（キャラ + 地 + 線色）を自前で固定するため generator のプリセットは使わない。キャラのワイン色は変えない。

---

## 6. Service Worker

`vite-plugin-pwa` の `generateSW`。ファイル名 `sw.js`。登録はバンドル JS から `navigator.serviceWorker.register`（CSP の `script-src 'self'` を守るためインライン登録は使わない。`workbox-window` は足さない）。Cloudflare Vite の worker 環境には SW を出さない。

| 対象 | 戦略 | 理由 |
|---|---|---|
| ビルドした静的ファイル（HTML / JS / CSS / アイコン） | precache | スタンドアロン起動と再訪 |
| `/api/*`（認証・写真本文を含む） | **NetworkOnly** | セッション付き JSON / 認可付き画像を SW キャッシュしない |
| `/models/**` | precache **しない** | 4.5MB の ONNX。既存の Cache API が担う |
| 存在しない `/assets/*`（古いハッシュの JS / CSS） | **404**（HTML にしない） | Workers の SPA fallback が `index.html` を返すと、`nosniff` でスクリプト実行が拒否され空画面になる |

- `navigateFallback` は `index.html`（SPA）。denylist は `/api/` と `/assets/` と `/models/` と `*.js` / `*.mjs` / `*.css` / `*.wasm` / `*.onnx` と `/version.json`
- `registerType: autoUpdate` + `skipWaiting` + `clientsClaim`。デプロイ後は新 SW がすぐ有効
- **初回インストール**（この文書読み込み時点で `controller` が無い）では `controllerchange` で再読み込みしない
- **既存バージョンからの更新**では再読み込みを `app-reload` に一元化する。短時間の重複・画面再起動をまたぐループはしない
- 未保存フォームがあるとき、および再読み込みループ回避のときは再読み込みせず、既存の離脱保護（破棄確認）を通す更新トーストを出す
- フォアグラウンドに戻ったとき `registration.update()` を呼ぶ。SPA の画面遷移やスタンドアロン起動の再開だけでは、ブラウザが `sw.js` を取りに行かないことがある
- 配信中の版（`/version.json`）と表示中のビルド ID が違うときも、同じ更新トーストを出す。iOS スタンドアロンなど SW の `controllerchange` が弱い環境の補完
- SW 登録失敗はアプリ本体の表示を止めない
- `urlPattern` は SW に閉じた関数にする（ビルド時に外部 import 名だけが残ると NetworkOnly が死ぬ）
- precache に無い JS / CSS が `text/html` で返ったときは 404 として扱う（古い HTML が消えたチャンクを指す場合）
- `pnpm dev`（Vite）では SW を登録しない（HMR と CSP 未適用のため）。確認は `pnpm build` → `wrangler dev --env dev`
- 古い SW が残って壊れたときの外し方は README
- 通常の復旧では Cookie / IndexedDB / localStorage / 全キャッシュを一括削除しない
- お酒の Google 検索は `https://www.google.com/search` への外部遷移。scope は `/` のまま広げない。検索結果を precache しない

Workers Static Assets の `_headers` で次を付ける。

| パス | Cache-Control | 理由 |
|---|---|---|
| `/*`（HTML / SPA fallback） | `no-cache` | デプロイ後に古い `index.html` が新しいハッシュ付き JS/CSS を指すと、ラベルやボタン名が消える |
| `/assets/*` | `! Cache-Control` のあと `public, max-age=31536000, immutable` | ファイル名にハッシュがある。中身が変わったら URL が変わる。`/*` と両方当たると値がカンマ結合されるため先に外す |
| `/sw.js` / `/boot-guard.js` / `/boot.css` / `/version.json` | `no-cache` | 古い SW・起動 CSS・版情報が残るとデプロイ後に壊れる／古いと判定できない |

SW 登録は `updateViaCache: "none"`（ブラウザが `sw.js` を HTTP キャッシュから使わない）。

`boot.css` は `html:not([data-theme])` のときだけ地色と文字色を付ける。OS の `prefers-color-scheme` を `data-theme` 付きの html/body/#root に残さない（本 CSS より強く、設定行のラベルが地色に溶ける）。

`run_worker_first` は `/api/*` に加え `/assets/*`。ハッシュ付き資産が無いときは Worker が 404 を返し、SPA の HTML を JS として渡さない。本番だけホスト正規化のため `true`（全パスが Worker 先）。非 API は ASSETS へ戻す（[custom-domain.md](custom-domain.md)）。

起動・失敗時の画面は [screen-designs/00-common.md](../screen-designs/00-common.md) 2.10。認証の通信失敗は [auth.md](auth.md)。

引っ張り更新のあとに地色だけになる現象と、再起動後に中身は見えるが縦スクロールできない現象は別経路。後者は `.app-content` がスクロール容器になっていないレイアウト（または document 側の overflow lock）を疑う。`overscroll-behavior-y: none` の削除や `overflow: auto !important` の一括適用では直さない。

---

## 6.1 版表記と最新化

ホーム追加した端末は、デプロイ後も古い Precache のまま動き続けることがある。設定で「今どの版か」と「今すぐ揃える」を見えるようにする。

| 項目 | 値 |
|---|---|
| 設定 S7 | `酒のしおり 0.1.0 (abcdef1)`。製品版は `APP_VERSION`。括弧内はデプロイしたコミットの短い SHA（7 桁。ローカルで取れないときは `dev`） |
| 埋め込み | ビルド時に `VITE_APP_BUILD_ID` / `GITHUB_SHA` / `git rev-parse` の順。CI の deploy はチェックアウトした SHA を明示する |
| `/version.json` | `{ "version": "0.1.0", "buildId": "abcdef1" }` だけ。シークレット・内部パスなし。公開 API ではない（`/api/*` を増やさない） |
| 配信 | SW precache しない。runtime は NetworkOnly。`Cache-Control: no-cache`。無いときは SPA の HTML を版情報として使わない |
| 設定 S18 | 「最新の状態にする」。副文「表示している版を、配信中の最新に揃えます」 |

S18 の手順:

1. オフラインなら再読み込みしない（共通のオフライン文）
2. 先に再読み込み記録を書く（`claimAppReload("user")`）。`update()` の skipWaiting が `controllerchange` で二重に `reload` しない
3. 登録済み SW の `update()` と、制御中なら有効化待ち（合計最大 8 秒で打ち切る）。SW が無い開発（Vite）では待たない
4. **制御中 SW の Workbox precache は消さない。** 空のままナビすると Workbox の `navigateFallback` が失敗し、Chrome（特に Android / スタンドアロン）が `ERR_FAILED`（「このサイトにアクセスできません」）を履歴に積む。戻ると直る、という UX になる
5. 古い precache は新 SW の `cleanupOutdatedCaches` が消す。切り抜きモデルの Cache API / Cookie / localStorage / IndexedDB / セッションは消さない
6. 未保存があれば既存の離脱保護を通し、同一パス（`pathname` + `search` + `hash`）を `location.replace` する。`location.reload()` は使わない

トースト「新しいバージョンがあります」+「更新」は、未保存時の SW 更新に加え、`/version.json` の不一致でも出す。押したあとの再読み込みは S18 と同じ経路。

---

## 6.2 アプリアイコンのバッジ（段階 1）

ホーム画面に追加したアプリのアイコンに、友達ヘッダー F2 の未読バッジと同じ件数を出す。W3C Badging API（`navigator.setAppBadge` / `navigator.clearAppBadge`）だけを使う。段階 1 のこの経路は通知の許可を求めない。プッシュ・許可の要求・SW の `push` ハンドラ・購読・VAPID は段階 2（6.3。[web-push.md](web-push.md)）。SW の `/api/*` NetworkOnly は変えない。

| 項目 | 値 |
|---|---|
| 件数 | `GET /api/social/notifications/unread-count` の `count`（[api-design.md](../api-design.md) 4.12）。セッションの userId 宛て `social_notifications` のうち `read_at` が空の行（`friend_request` / `friend_accepted` / `reaction`）。F2 と同じ query（`queryKeys.socialUnread`）を共有する。新しいデータは保存しない |
| 表示 | 1 以上は `setAppBadge(n)`。0 は `clearAppBadge()`。99 超の丸めはしない（見た目は OS が決める） |
| 取得条件 | 認証後シェル（`AppShell`）で、`GET /api/me` が年齢確認済みのときだけ。未確認では 403 になるため取りに行かない |
| 更新契機 | シェルの初回表示、前面復帰（`visibilitychange` が `visible` で未読数を取り直す）、通知一覧の取得後、既読化（1 件 / すべて）の成功後。申請・承認などほかの友達操作は既存の invalidate で追従する |
| 消す | ログアウト（`endSession`。API の 401 による自動ログアウトも同じ経路）、セッション確認で未ログインと判定したとき（`RequireAuth`）、アカウント削除の受付（当該タブと BroadcastChannel で受けた他タブ。`discardAccountScopedClientData`）。前のユーザーの件数を残さない |
| 非対応・失敗 | 機能検出。メソッドが無ければ何もしない。同期例外・reject は握りつぶし、画面を止めない。未読数の取得に失敗したときはバッジを変えない |
| 実装 | `src/client/lib/app-badge.ts`（`syncAppBadge` / `clearAppBadge`）、`src/client/hooks/use-app-badge.ts`（`useAppBadgeSync`。`AppShell` で 1 回） |

端末ごとの見え方（2026-09 時点の各ブラウザの公開情報。実機確認はオーナー。[qa-devices.md](../qa-devices.md) 4.6）:

| 環境 | 見え方 |
|---|---|
| iPhone / iPad のホーム画面 PWA（iOS 16.4+。サポート最小は 17） | API はある。**通知が許可されているときだけ数字が出る**（WebKit の仕様）。段階 1 の経路は許可を求めない。設定 S23 でプッシュをオンにして許可すると、直前に設定した件数が出る |
| Android Chrome のインストール PWA | Badging API は表示されない（メソッドがあっても何も出ない端末がある）。Android のドットは OS が「未読の通知」に付けるもので、プッシュ（段階 2）をオンにした端末で通知が残っているあいだ出る |
| Windows / macOS の Chrome・Edge でインストールした PWA | タスクバー / Dock のアイコンに数字 |
| ブラウザのタブ | 出ない（インストールしたアプリだけ） |

段階 1 はアプリが動いている間しか更新しない。プッシュをオンにしていない端末では、閉じている間に届いた通知や、別の端末で既読にした分は、次に開くか前面に戻るまでアイコンに反映されない（古い件数が残ることがある）。

---

## 6.3 プッシュ通知（段階 2）

正本は [web-push.md](web-push.md)。PWA 側の契約だけ置く。

| 項目 | 値 |
|---|---|
| SW | `generateSW` のまま `workbox.importScripts: ["sw-push.js"]`。`public/sw-push.js` が `push` と `notificationclick` を持つ |
| `push` | 汎用文（名前・お酒・リアクション種類なし）で `showNotification`。ペイロードの `unread` でバッジを `setAppBadge(n)` / `clearAppBadge()` |
| `notificationclick` | `/friends/notifications` を開く（既存ウィンドウは前面へ） |
| キャッシュ | `/api/*` は NetworkOnly のまま。`sw-push.js` は precache しない。`_headers` で `no-cache` |
| 許可 | 起動時に求めない。設定 S23 と通知画面 N1 の操作だけ |
| 閉じている間のバッジ | プッシュをオンにした端末は、通知が届いた時点で未読数に更新する。既読化は無表示プッシュを送らないため、次の起動・前面復帰で段階 1 が直す |

---

## 7. iOS / Apple

| 項目 | 値 |
|---|---|
| `apple-mobile-web-app-capable` / `mobile-web-app-capable` | `yes` |
| `apple-mobile-web-app-title` | `酒のしおり`（`short_name` と同じ） |
| `apple-mobile-web-app-status-bar-style` | `default`（`theme-color` に合わせる） |
| `apple-touch-icon` | `/pwa/apple-touch-icon.png` |

iOS の SW 対応は限定的。ホーム追加は manifest + Apple メタが主。実機確認は [qa-devices.md](../qa-devices.md)。

---

## 8. 対象外

- オフラインでの記録作成・編集・同期
- Background Sync / Periodic Background Sync
- 友達のお知らせ以外のプッシュ（新規投稿・広告・運営からのお知らせ）。友達のお知らせのプッシュは 6.3
- ストア申請
- iOS 向け `apple-touch-startup-image` の全解像度（6-05 で作らないと確定。スプラッシュは `background_color` + アイコン）

---

## 9. セキュリティ

- SW の scope はアプリ全体。配信は Workers の HTTPS のみ
- `/api/*` を CacheFirst / StaleWhileRevalidate にしない（Cookie 付き JSON・写真）
- SW 登録スクリプトを HTML インラインにしない（CSP）。起動ガードは `/boot-guard.js`（`'self'`）
- ログにセッショントークン・Cookie・個人の記録を出さない（既存どおり）
- アイコンのバッジは件数だけ。通知本文・相手の名前は OS に渡さない。ログアウト・未ログイン判定・アカウント削除で消す
- プッシュのペイロードは種別と未読数だけ。ロック画面は汎用文。ログアウト・アカウント削除で端末の購読を解除する（[web-push.md](web-push.md) 8 章）

---

## 10. 受け入れ

- [ ] ビルド成果に `manifest.webmanifest` があり、`display` が `standalone`
- [ ] 192 / 512 / maskable / Apple touch の PNG がある
- [ ] SW が `/api/` を NetworkOnly にし、`/models/` を precache しない
- [ ] 存在しない `/assets/*.js` が HTML ではなく 404 を返す
- [ ] `boot.css` が `data-theme` 付きの html/body に色を残さない。SW 登録は `updateViaCache: "none"`
- [ ] 起動中に「読み込み中」が見え、失敗時に説明と再試行がある
- [ ] 初回インストールで不要な再読み込みをしない。更新再読み込みはループしない
- [ ] 設定の版表記に短いビルド ID が付き、デプロイごとに変わる
- [ ] `/version.json` が JSON で、HTML の SPA fallback にならない
- [ ] 設定「最新の状態にする」で再読み込みできる。オフラインでは再読み込みしない。接続エラーページ（`ERR_FAILED`）には出ず、設定のまま戻る
- [ ] 表示名は 酒のしおり。アイコン地はライトの地色。キャラのワイン色は変えない
- [ ] アイコンのバッジは F2 と同じ未読数。0 で消える。前面復帰・既読化で追従する。非対応環境で例外を出さない
- [ ] ログアウト・アカウント削除でバッジが消え、次のユーザーに前の件数が残らない。起動時に通知許可を求めない
- [ ] SW が `sw-push.js` を読み込み、`push` で汎用文の通知とバッジ更新、タップで通知一覧を開く（6.3）
- [ ] lint / typecheck / test がパスする
- [ ] 監査: SW が秘密・認可レスポンスをキャッシュしない
