# Web Push（段階 2・友達のお知らせ）

アプリを閉じている間も、友達のアプリ内通知（申請・承認・リアクション）を端末の通知として届け、ホーム画面アイコンのバッジを未読数に合わせる。段階 1（アプリが動いている間だけのバッジ）は [pwa.md](pwa.md) 6.2。

- 状態: **実装**（2026-09-23 オーナー承認）
- 画面: 設定 S23（[06-settings.md](../screen-designs/06-settings.md)）、友達の通知 N1 カード（[13-friends.md](../screen-designs/13-friends.md)）
- 列: [data-model.md](../data-model.md) 6.16。API: [api-design.md](../api-design.md) 4.13。秘密: [secrets.md](../secrets.md)
- 法務: [legal.md](../legal.md)（版 `2026-09-23`）

---

## 1. オーナー決定（2026-09-23）

| 項目 | 決定 |
|---|---|
| 送る通知 | 既存のアプリ内通知 `friend_request` / `friend_accepted` / `reaction` だけ。新規投稿・広告・お知らせ配信は送らない |
| 許可の要求 | 利用者が明示の操作（設定 S23 のスイッチ、または通知画面 N1 の「通知を受け取る」）を押したときだけ。起動時・画面表示時には求めない。拒否後は OS の設定での戻し方を説明し、繰り返し求めない |
| 端末単位 | 購読は端末（ブラウザ）ごと。オフにするとその端末の購読だけ消す |
| ロック画面の文言 | 名前・お酒・リアクションの種類・写真を出さない（3 章） |
| 暗号 | RFC 8291（`aes128gcm`）+ VAPID（RFC 8292）。Workers の WebCrypto だけで実装する。依存は足さない |
| ペイロード | 種別と未読数だけ（`{ "v": 1, "type": "reaction", "unread": 3 }`）。本文・名前・ID は入れない |
| 送信 | 元の API 応答を待たせない（`waitUntil`）。失敗ログにエンドポイント・鍵・トークンを出さない |
| 鍵が無い環境 | プッシュを使えないだけ。起動・他機能は止めない（`GET /api/push/config` が `available: false`） |

---

## 2. 対応環境

| 環境 | 動き |
|---|---|
| iPhone / iPad のホーム画面 PWA（iOS 16.4+。サポート最小 17） | 使える。通知許可後はアイコンの数字も出る（WebKit は許可が無いとバッジを出さない） |
| iPhone / iPad の Safari タブ | `PushManager` が無い。S23 は無効で「ホーム画面に追加した酒のしおりで使えます」 |
| Android Chrome（インストール PWA / タブ） | 使える。未読の通知があるあいだ OS がアイコンにドットを付ける |
| デスクトップ Chrome / Firefox | 使える（FCM / Mozilla）。Edge（WNS）など既知の配信サービス外のエンドポイントは 400 で受けない |
| `pnpm dev`（Vite） | SW を登録しないため購読できない。確認は `pnpm build` → `wrangler dev --env dev` と実機 |

配信サービスの許可リスト（エンドポイントのホスト。`https:` のみ。ポート指定・認証情報付き URL・IP は不可）:

| 提供元 | ホスト |
|---|---|
| Google（FCM。Chrome / Android / Samsung Internet 等） | `fcm.googleapis.com` |
| Mozilla（Firefox） | `updates.push.services.mozilla.com` |
| Apple（Safari / iOS / iPadOS） | `web.push.apple.com` と `*.push.apple.com` |

---

## 3. 通知の文言（ロック画面）

正本は `src/shared/web-push.ts` の `PUSH_COPY`。SW（`public/sw-push.js`）は同じ文字列を持ち、単体テストが一致を固定する。

| 種別 | タイトル | 本文 |
|---|---|---|
| `friend_request` | 酒のしおり | 友達申請が届きました |
| `friend_accepted` | 酒のしおり | 友達申請が承認されました |
| `reaction` | 酒のしおり | あなたの共有にリアクションがありました |
| 不明・壊れたペイロード | 酒のしおり | 友達から新しいお知らせがあります |

- 相手の名前、お酒の名前・種類、リアクションの種類（乾杯・飲んでみたい等）、写真、画像は出さない
- 飲酒を促す言葉（「飲もう」「もう一杯」等）は使わない（[character.md](../character.md) 1 章）
- アイコンは `/pwa/pwa-192x192.png`。`image` は付けない
- `tag: "social"` で 1 件にまとめて置き換える（`renotify: true`）。複数の未送達は `Topic: social` で配信サービス側でも 1 件に畳まれる
- タップで `/friends/notifications` を開く。開いているウィンドウがあれば前面にしてそこへ移る

---

## 4. 購読の流れ（クライアント）

`src/client/lib/web-push.ts`。画面は `usePushNotifications`（`src/client/hooks/use-web-push.ts`）経由。

### 4.1 オンにする（利用者の操作から）

1. クリックハンドラの **最初の await** で `Notification.requestPermission()`（iOS はユーザー操作の中でしか許可を出せない）
2. `granted` 以外は購読しない。`denied` は S23 / N1 に OS 設定の案内を出す。`default`（閉じた）は何も出さない
3. SW 登録（`navigator.serviceWorker.ready`。3 秒で打ち切り）の `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`。既存購読の鍵が現在の公開鍵と違えば解除してから作り直す
4. `PUT /api/push/subscription` に `subscription.toJSON()` を送る
5. 保存に失敗したら購読を解除して作り直し、1 回だけ登録し直す（他アカウントに同じ `endpoint` が残っているときの 404 を含む）。それでも失敗したら購読を解除して元に戻す（端末だけ購読が残らない）

### 4.2 オフにする

`DELETE /api/push/subscription`（`endpoint`）→ `subscription.unsubscribe()`。サーバー削除が失敗しても端末の購読は解除する。

### 4.3 起動時の同期

認証後シェルで、年齢確認済み・`available: true`・通知が `granted`・端末に購読があるときだけ、1 セッションに 1 回 `PUT` し直す（配信サービス側の更新や、別アカウントで消えた行を戻す）。公開鍵が変わっていたら作り直す（許可済みなので再び求めない）。**許可は求めない。** 許可が無い・購読が無いときは何もしない。

### 4.4 ログアウト・アカウント削除

`endSession`（明示のログアウトと 401）と `discardAccountScopedClientData`（削除受付）で、端末の購読を `unsubscribe()` する（待たない）。サーバー行はセッション削除の CASCADE とアカウント削除の CASCADE で消える。次にログインしても自動では購読しない。

---

## 5. サーバー

### 5.1 保存（`push_subscriptions`）

- 1 行 = 1 端末の購読。`endpoint` は全体で一意
- `user_id` はセッションのユーザー、`session_id` は登録したセッション。`session` の削除（ログアウト・失効の掃除・パスワード変更による他セッション失効）で CASCADE。ユーザー削除でも CASCADE
- `endpoint` が他人の行と同じときは 404（他人の行は書き換えない・存在も示さない）。通常はログアウトでセッションごと行が消えるため起きない。起きたときはクライアントが端末の購読を解除して作り直し（別の `endpoint`）、1 回だけ登録し直す。前の人の古い `endpoint` は配信サービスが 410 を返した時点で消える
- 1 ユーザー最大 10 端末。超えたら `updated_at` が最も古い行から消す
- User-Agent は保存しない

### 5.2 送信

`src/server/services/web-push.ts`。`upsertNotification` が「新しく未読になった」とき（新規行、または既読行が未読に戻ったとき）だけ、呼び出し元ルートが `waitUntil` で `sendSocialPush` を走らせる。既に未読の行の更新・既読化・削除では送らない（`userVisibleOnly` のため、表示を伴わない「バッジだけの更新」は送らない）。

1. VAPID 鍵が無ければ何もしない
2. 受信者の購読のうち、`session.expires_at` が未来の行だけに送る。期限切れセッションの行は消す
3. 未読数を数え、ペイロード `{ v: 1, type, unread }` を端末ごとに暗号化（`aes128gcm`、レコード 4096、パディングなし）
4. `POST <endpoint>`。ヘッダー `TTL: 86400` / `Urgency: normal` / `Topic: social` / `Content-Encoding: aes128gcm` / `Authorization: vapid t=<JWT>, k=<公開鍵>`。JWT は ES256、`aud` = エンドポイントのオリジン、`exp` = 12 時間後、`sub` = `VAPID_SUBJECT`（未設定なら `https://sake-shiori.com`）。10 秒で打ち切る。リダイレクトは追わない（3xx は失敗）
5. `404` / `410` はその行を消す。その他の失敗は `[push] send failed` と状態コードと配信サービスのホストだけをログに出して行は残す

### 5.3 レート制限

`PUT /api/push/subscription` は 1 ユーザー 1 時間 20 回（メモリ。数値はレスポンスに出さない）。超えたら 429 `rate_limited`。

---

## 6. SW

`vite-plugin-pwa`（`generateSW`）の `workbox.importScripts` で `public/sw-push.js` を読む。`/api/*` の NetworkOnly は変えない。`sw-push.js` は precache しない（`no-cache`。SW 更新時にブラウザが取り直す）。

| イベント | 処理 |
|---|---|
| `push` | ペイロードを JSON として読み、`type` と `unread` を検証。3 章の文言で `showNotification`。`unread` が 1 以上なら `navigator.setAppBadge(unread)`、0 なら `clearAppBadge()`。読めないときは汎用文だけ出してバッジは変えない。バッジ API が無い・失敗は無視 |
| `notificationclick` | 通知を閉じ、同一オリジンのウィンドウがあれば `focus()` して `/friends/notifications` へ `navigate`、無ければ `clients.openWindow` |

---

## 7. 秘密・設定

| キー | 置き場 | 内容 |
|---|---|---|
| `VAPID_PUBLIC_KEY` | `.dev.vars` / wrangler secret | P-256 公開鍵（非圧縮 65 バイト）の base64url |
| `VAPID_PRIVATE_KEY` | `.dev.vars` / wrangler secret | 秘密鍵 `d`（32 バイト）の base64url。**表示・ログ・チャットに出さない** |
| `VAPID_SUBJECT` | wrangler `vars`（任意） | `https:` または `mailto:`。未設定は `https://sake-shiori.com` |

- ローカルは `pnpm dev:vars` が無いときだけ生成する（既存は上書きしない。値は出力しない）
- 本番・dev は `pnpm vapid:put -- --env production`（または `--env dev`）。端末内で鍵を作り、標準入力で `wrangler secret put` に渡す。秘密鍵は画面にもファイルにも出さない
- 片方だけ・形式不正は「鍵なし」と同じ扱い（`available: false`）
- 鍵を替えると既存の購読は配信サービスに拒否される。各端末は次の起動時の同期（4.3）で作り直す

---

## 8. セキュリティ

- 3 つの API はすべて認証と年齢確認を通す。公開エンドポイントは増やさない
- 購読の一覧 API は作らない。他人の購読を返さない。削除は `endpoint + user_id` 一致だけ
- エンドポイントは許可リストの `https:` ホストだけ（SSRF 対策）。鍵は長さと P-256 の点として検証する
- ペイロードに個人の内容を入れない。配信サービスには暗号文だけが渡る
- ログに `endpoint` / `p256dh` / `auth` / JWT / 秘密鍵を出さない
- CSP・`connect-src` は変えない（配信はサーバーから）

---

## 9. 対象外

- 新規投稿・広告・運営からのお知らせのプッシュ
- 既読化を他端末へ伝える無表示プッシュ（`userVisibleOnly`。バッジは次の起動・前面復帰で段階 1 が直す）
- 通知の種類ごとのオン・オフ、静かな時間帯
- `pushsubscriptionchange` での自動再登録（起動時の同期 4.3 で直す）
- ネイティブアプリ・APNs 直結

---

## 10. 受け入れ

- [ ] 起動・画面遷移だけでは通知の許可を求めない。S23 または N1 の操作でだけ求める
- [ ] 許可後に購読が保存され、友達申請・承認・リアクションで購読した端末へ暗号化プッシュを送る（アプリを閉じた実機での到達はオーナーが [qa-devices.md](../qa-devices.md) 4.7 で確認）
- [ ] ロック画面に名前・お酒・リアクションの種類・写真が出ない。タップで通知一覧が開く
- [ ] SW の `push` でアイコンのバッジが未読数になり、0 で消える
- [ ] オフ・ログアウト・アカウント削除・配信サービスの 404/410 で購読が消える
- [ ] 鍵が無い環境で落ちず、S23 は「現在は使えません」
- [ ] 他人の購読を消せない・書き換えられない（同じ `endpoint` でも 404）。未認証 401、年齢未確認 403
- [ ] ペイロードは RFC 8291 のベクタどおりに暗号化され、中身は種別と未読数だけ
- [ ] lint / typecheck / test / E2E がパスする
