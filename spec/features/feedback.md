# ご意見・ご要望（設定からの問い合わせ）

実装: 設定「このアプリ」から運営者へ改善案・不具合を送る。画面は [screen-designs/12-feedback.md](../screen-designs/12-feedback.md) と [06-settings.md](../screen-designs/06-settings.md) S17。API は [api-design.md](../api-design.md) 4.12。データは [data-model.md](../data-model.md) 6.14。通知は Resend（既存のパスワード再設定と同じ基盤）。

- 状態: **実装**（2026-09-12）。Resend の `FEEDBACK_TO` 投入はオーナー（[8 章](#8-オーナー作業-resend)）

---

## 1. 目的

利用者が設定から、アプリの改善案・不具合・その他を本文と任意の画像付きで送れるようにする。運営者はメールで気づき、D1 に匿名化可能な形で集約する。

---

## 2. 対象 / 対象外

**対象**

- 設定「このアプリ」の入口と `/settings/feedback`
- 認証済み `POST /api/feedback`（年齢確認の対象）
- 本文と画像（最大 3 枚）の D1 + R2 保存
- Resend による運営者への通知（本文 + 画像添付）
- アカウント削除時の匿名化（`user_id` を外し、本文と画像は残す）
- 日次件数上限（内部値。UI / PP には数値を出さない）

**対象外**

- 利用者向けの送信履歴・スレッド・返信 inbox
- 運営者向け管理画面・一覧 API
- 公開（未ログイン）の問い合わせ口
- 写真の切り抜き・キャラ合成・AI 解析
- 24 時間以内の返信保証（[operations.md](../operations.md) のとおりサポート SLA は無い）
- 新しい npm パッケージ（Resend は既存どおり `fetch`）

---

## 3. 決定

| 項目 | 決定 | 根拠 |
|---|---|---|
| 入口 | 設定「このアプリ」の先頭行「ご意見・ご要望 ›」 | 規約・PP と同じ節。スイッチ一覧を汚さない |
| 画面 | `/settings/feedback`。タブバー非表示。戻るは設定 | アカウント削除と同じ型。長い本文とキーボード |
| API | `POST /api/feedback` のみ。GET / PATCH / DELETE は作らない | 利用者は送りっぱなし。管理者一覧はロールが無い |
| 認証 | セッション必須。`userId` は `c.get("user").id` のみ | security.mdc |
| 年齢 | 通常の機能 API。未確認は 403 `age_required` | 削除だけが exempt |
| 種類 | `improvement` / `bug` / `other` | 集約の軸。画面は「改善案 / 不具合 / その他」 |
| 本文 | 1〜2000 文字。trim 後 | メモ 500 より長く、画面に収まる |
| 画像 | 0〜3 枚。jpeg / png / webp。magic bytes。1 MiB・長辺 1600 | 既存写真と同じサーバー検証。キーはサーバー生成 |
| 画像の加工 | 端末で長辺 1280 に縮小して JPEG 化。切り抜き・キャラ合成はしない | スクリーンショットを歪めない |
| 保存 | `feedbacks` + `feedback_photos`。`photos` テーブルには入れない | 退会時の R2 回収に巻き込まれない |
| `user_id` | 送信時は必須。退会で `ON DELETE SET NULL` | 匿名化して残す（オーナー決定） |
| 通知 | Resend。To は secret `FEEDBACK_TO`。From は `EMAIL_FROM`。Reply-To は送信時の登録メール | 既存キーを再利用。値はコードに書かない |
| 未設定 | `RESEND_API_KEY` / `EMAIL_FROM` / `FEEDBACK_TO` のどれかが無いときは保存だけ行い、通知は skip | リセットメールと同じ。CI が外部送信しない |
| 失敗 | 保存成功後の通知失敗は 201 のまま。ログは `feedback email send failed` だけ | 本文・メールをログに出さない |
| 日次上限 | ユーザーあたり **3 件 / JST 日**。超過は 429 `rate_limited`。数値は UI / PP に出さない | スパム。写真上限と同じ方針 |
| 返信 | 約束しない。画面に「返信をお約束するものではありません」 | operations。個人運用 |
| 公開 API | 増やさない | スパム口にしない |

---

## 4. 画面と導線

正本は [12-feedback.md](../screen-designs/12-feedback.md)。

1. 設定「このアプリ」→「ご意見・ご要望」→ `/settings/feedback`
2. 種類を選び、本文を入れ、任意で写真を撮る / 選ぶ（最大 3）
3. 「送信する」。成功はトースト「送りました」（キャラなし）→ 設定へ戻る
4. 失敗は汎用文。429 は「しばらく待ってから試してください」

---

## 5. サーバー処理

1. 認証・年齢ゲートを通す
2. `multipart/form-data` を Zod で検証（`category` / `body`）。画像は `photos` フィールド（0〜3）
3. 各画像を magic bytes・サイズ・長辺で検証。クライアントの Content-Type / ファイル名は信用しない
4. 当日（JST）の当該 `user_id` 件数を数え、3 以上なら 429
5. `feedbacks` を挿入（`user_id` = セッション）。R2 キーは `feedback/{photoId}.{ext}`（`user_id` も元ファイル名も含めない）
6. Resend へ通知（設定済みのとき）。本文に種類・JST 日時・利用者 ID・登録メール・本文。画像は添付。ログに本文・メール・Cookie を出さない
7. 201 `{ "ok": true }`。`r2Key` / `userId` は返さない

一覧・詳細・画像配信 API は作らない。運営者はメールと D1 で見る。

---

## 6. アカウント削除

`user` 削除時、`feedbacks.user_id` は **SET NULL**。`feedback_photos` と R2 オブジェクトは残す。

- 削除バッチの `INSERT SELECT ... FROM photos WHERE user_id = ?` には載らない（別テーブル）
- D1 にメール・表示名は持たない。残るのは種類・本文・画像・送信日時
- 通知済みのメール控えは運営者の受信箱に残ることがある（PP に書く）
- 再登録しても旧行とは結びつかない

---

## 7. 法務

PP のデータマップと保管期間に、ご意見の本文・添付画像と「退会後は送信者と結びつかない形で残す」を書く。Resend の委託目的に通知メールを足す。版は `2026-09-13`。再同意ゲートは作らない（8-01 どおり）。

---

## 8. オーナー作業（Resend）

アプリはキーが揃ったときだけ通知する。**未投入でも送信 UI と D1 保存は動く**（届くメールが無いだけ）。

パスワード再設定（8-03）で Resend を使っている場合、ドメイン認証と `RESEND_API_KEY` / `EMAIL_FROM` は流用できる。足りないのは **宛先** だけである。

### 8.1 初回（未導入のとき）

1. [Resend](https://resend.com) でアカウントを作る
2. `sake-shiori.com` を Domains に追加し、DNS（SPF / DKIM）を入れる。検証が通るまで待つ
3. API Keys で送信用キーを発行する。値はチャット・PR・スクショに貼らない
4. 次を投入する（値は標準出力に残さない）

```powershell
pnpm exec wrangler secret put RESEND_API_KEY --env dev
pnpm exec wrangler secret put RESEND_API_KEY --env production
```

5. From は wrangler `vars` の `EMAIL_FROM`（秘密ではない）。本番は `酒のしおり <noreply@sake-shiori.com>`。未設定なら通知は送らない

### 8.2 ご意見の宛先（本機能で必須）

運営者が受け取るメールアドレスを **secret** `FEEDBACK_TO` に入れる。コード・spec・`wrangler.jsonc` に実アドレスを書かない。

```powershell
# ローカル: .dev.vars に FEEDBACK_TO= を足す（git に含めない）
pnpm exec wrangler secret put FEEDBACK_TO --env dev
pnpm exec wrangler secret put FEEDBACK_TO --env production
```

投入後、対象 env をデプロイする（secret の反映にデプロイが必要なことがある）。

確認:

1. 本番（または dev）にログインし、設定 → ご意見・ご要望 → 改善案で短い本文を送る
2. `FEEDBACK_TO` の受信箱に件名「【酒のしおり】ご意見（改善案）」が届く
3. Reply すると送信者の登録メールに返る（Reply-To）
4. 画像を付けた送信では、同じメールに添付が付く

届かないとき（値はチャットに貼らない）:

- Resend ダッシュボードの Logs で 4xx / ドメイン未検証を見る
- `FEEDBACK_TO` / `RESEND_API_KEY` / `EMAIL_FROM` が **同じ env** に揃っているか
- 迷惑メール
- Workers Logs に `feedback email send failed` だけ出る（本文は出ない）

### 8.3 運用

- 集約の正本は D1（退会後も匿名で残る）。メールは気づき用
- 必要なら Resend の受信箱ルールやラベルで「改善案 / 不具合」を分ける
- Resend Free は 100 通/日・3000 通/月。リセットと合算。超過は [usage-monitoring.md](usage-monitoring.md)
- 宛先を変えるときは対象 env だけ `wrangler secret put FEEDBACK_TO`。旧アドレスへの通知は止まる
- ローテーションは [secrets.md](../secrets.md)

---

## 9. テスト

- Vitest: 未認証 401、年齢未確認 403、バリデーション 400、日次 4 件目 429、画像 magic bytes、他ユーザーの `userId` をボディに載せても無視（スキーマに無いキーは 400 または無視してセッションを使う）、退会後に行が `user_id` NULL で残り R2 が消えない
- 通知の単体: キー無しは skip、キーありは Resend へ `fetch`（本文にパスワードを含めない）
- 画面: 設定に入口があること、送信成功で設定へ戻ること（ソース固定 + 手動）

---

## 10. 受け入れ

- [ ] 設定「このアプリ」からご意見・ご要望へ行ける
- [ ] 種類・本文・最大 3 枚の画像を送れ、成功で「送りました」
- [ ] 未認証は 401。日次上限超過は 429
- [ ] 画像はサーバーが magic bytes とサイズを見る。R2 キーにファイル名 / user_id が無い
- [ ] 退会後も本文と画像が残り、`user_id` は NULL
- [ ] `FEEDBACK_TO` 未設定でも保存は成功し、アプリは落ちない
- [ ] ログに本文・メール・Cookie が出ない
