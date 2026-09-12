# 無料枠の使用量監視と課金方針（8-06）

実装: Phase 8-06。確認手順の正本は本ファイル。週次の見方は [operations.md](../operations.md) 9 章。数字のコピーは [02-tech-stack.md](../02-tech-stack.md) 「ランニングコスト見積り」と同期する。

- 状態: **8-06**（2026-09-10）。無料枠の公式数字を再確認。Cloudflare の予算アラートと AI Gateway 支出上限の投入はオーナー
- ユーザー向けの使用量画面は置かない。公開 API に使用量を出さない

---

## 1. 目的

Workers / D1 / R2 / Workers AI / AI Gateway / Resend / GitHub Actions の使用量を週次で見て、公開後に突然課金されないようにする。超過時は先に登録を止め、必要なら Paid を検討する。

---

## 2. 対象 / 対象外

**対象**

- 監視項目と **80%** 閾値
- 週次確認手順（ダッシュボード。数値は public Issue に貼らない）
- 超過時プレイブック（新規登録の一時停止、写真・認識上限、Workers Paid）
- Cloudflare 予算アラートと AI Gateway 支出上限（設定はオーナー）
- 課金に進む判断基準

**対象外**

- 収益化
- 自動スケールの複雑な最適化
- 使用量を返す公開 API / 管理画面
- アカウントの課金情報・請求額の実値を spec に書くこと

---

## 3. 決定（8-06。ロードマップの要確認を落とす）

| 項目 | 決定 | 根拠 |
|---|---|---|
| 確認頻度 | **週 1**（エラー目視と同じ週） | 個人公開。日次自動化は新しいサービスを増やさない |
| 閾値 | 各無料枠の **80%** で「注意」、到達・超過でプレイブック | タスク例。余裕を見て手を打つ |
| 公開 API | `GET /api/health` は `{ "ok": true }` のみ。`GET /api/config` はサイトキーだけ。使用量・枠残を足さない | 情報漏洩。8-05 の契約を守る |
| 招待 | **作らない** | 2026-08-13 FIX |
| 登録停止 | wrangler `vars` の **`SIGNUPS_CLOSED`**。`1` / `true` のときメール登録と Google 新規を拒否。既存ログインは通す | 超過時の弁。招待コードではない |
| 停止文 | 「現在、新規登録を停止しています」。サーバーが返し、クライアントは **この文言だけ** を許可して出す | 任意のサーバー文を出さない。存在推測もしない |
| 写真 | 端末内で長辺 1280・品質 0.82、サーバー 1MB / 長辺 1600。日次 80 枚（8-05）。未リサイズの原画は保存しない | R2 10GB を守る |
| バックアップ R2 | `alco-app-d1-backups` も **同じアカウントの 10GB 無料枠**を食う。14 日・2 DB | 8-06 のリスク。写真バケットと合算 |
| 予算アラート | Cloudflare Billable Usage の **Budget alert**。情報通知のみ。使用は止まらない | [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)。Pay-as-you-go のみ |
| 実キャップ | **AI Gateway spend limits**（超過は 429）。Workers 無料枠の日次上限はプラットフォームが止める | Gemini は Unified Billing で **無料枠外の課金**になりうる |
| Paid 判断 | 下表。先に登録停止と上限下げ。それでも足りなければ Workers Paid（**月 5 USD**） | 突然の従量を避ける |

---

## 4. 無料枠（公式再確認）

確認日: **2026-09-10**。数字が公式と食い違ったら本ファイルと [02-tech-stack.md](../02-tech-stack.md) を同じ PR で直す。アカウント ID・請求額は書かない。

| サービス | 無料枠 | 80% | 超過時 | 公式 | 個人公開で見ること |
|---|---|---|---|---|---|
| Workers リクエスト | 10 万/日（UTC 0:00 リセット）。静的アセットは無料・無制限 | 8 万/日 | Error 1027 | [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) / [Limits](https://developers.cloudflare.com/workers/platform/limits/) | ボット。8-05 の WAF / Turnstile |
| Workers CPU | 10 ms / 起動 | Metrics で 10 ms 超過エラー | Error 1102 | 同上 | 重いハンドラ。画像は端末内 |
| Workers Logs | 20 万イベント/日、保持 3 日 | 16 万/日 | 当日は間引き | [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) | `console.log` の増やしすぎ |
| D1 読取 | 500 万行/日 | 400 万行/日 | クエリ失敗 | [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) | 全件スキャン API |
| D1 書込 | 10 万行/日 | 8 万行/日 | クエリ失敗 | 同上 | 連写・一括作成 |
| D1 容量 | 5 GB（アカウント合計） | 4 GB | 新規書込不可 | 同上 | テキスト中心なら余裕 |
| D1 Time Travel | Free は 7 日 | — | 古い時点に戻せない | [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) | 14 日は export（7-04） |
| R2 保存 | 10 GB-month（Standard） | 8 GB | 従量（$0.015/GB-month） | [R2 Pricing](https://developers.cloudflare.com/r2/pricing/) | 未リサイズ、バックアップ合算 |
| R2 Class A | 100 万/月 | 80 万/月 | 従量 | 同上 | PUT（写真・backup put） |
| R2 Class B | 1000 万/月 | 800 万/月 | 従量 | 同上 | GET（サムネ連打） |
| Workers AI | 1 万 Neurons/日 | 8000/日 | それ以上は Workers Paid | [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) | Llama に戻したとき |
| AI Gateway（Gemini） | 無料枠なし。Unified Billing | ダッシュボードの支出 | 請求。spend limit で 429 | [Spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/) | 記録・セラー・ノートの既定認識。**最初に $ が付きやすい** |
| Resend | 100 通/日・3000 通/月 | 80 / 2400 | 送信失敗 | [password-reset.md](password-reset.md) | リセット爆撃（8-05） |
| GitHub Actions | **public** の標準 runner は分が無料。artifact 500 MB | artifact 400 MB | private 化すると Free は 2000 分/月 | [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) | E2E を毎 PR。リポジトリは public |

Workers Paid に上げた場合の目安（確認日同じ）: 月額 **5 USD** + 超過分（リクエスト 1000 万/月込み、CPU 3000 万 ms 込み）。D1 Paid は読取・書込の月次込み枠が広がる。R2 の 10 GB 無料はプランを問わず残る。

Cron（`0 18 * * *`）は無料枠に含まれる。起動はリクエストとして数える。

---

## 5. 週次確認（オーナー）

値・Cookie・オブジェクトキー一覧・課金額のスクショを public Issue / PR / チャットに貼らない。メモは手元だけ。

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → `alco-app-prod`（必要なら `alco-app-dev`）→ Metrics / Observability。リクエスト/日、CPU 超過、エラー
2. D1 → `alco-app-prod` → Metrics（行読取・書込・容量）
3. R2 → `alco-app-photos-prod` と `alco-app-d1-backups` の保存量（**合算**が 10 GB 枠）
4. Workers AI → Neurons/日
5. AI Gateway → Unified Billing の支出。spend limit が生きているか
6. [Billable Usage](https://developers.cloudflare.com/billing/understand/how-billing-works/)（支払い方法があるとき）
7. Resend ダッシュボード（送信数）
8. GitHub → Actions の分と artifact。public のままか

80% を超えた項目は 6 章へ。超えていなければ記録して終わり。

### 5.1 写真のリサイズ確認（サンプル）

ダッシュボードの平均オブジェクトサイズ、または手元で 1 件だけ:

```powershell
pnpm exec wrangler r2 object get alco-app-photos-prod/<key> --file=backups/sample-photo.bin --remote
```

`<key>` とファイルはチャットに残さない。`backups/` は gitignore。サイズが **1 MB 超**ならパイプライン破綻（サーバー検証も 413）。目安は 150〜300 KB（長辺 1280 JPEG）。終わったら消す。

コード側の固定: `PHOTO_OUTPUT_LONG_EDGE` 1280、`PHOTO_MAX_BYTES` 1 MiB、`PHOTO_UPLOAD_DAILY_LIMIT` 80。単体テストで値を固定する。

---

## 6. 超過時プレイブック

招待制は使わない。順番は上から。既存ユーザーのログイン・記録は止めない。

### 6.1 新規登録を一時停止

1. `wrangler.jsonc` の対象 env で `SIGNUPS_CLOSED` を `"1"` にする（または `.dev.vars` / ダッシュボード vars）
2. その env をデプロイする（vars だけ変えても古いデプロイには乗らない）
3. メール登録と Google の `requestSignUp` が 400。「現在、新規登録を停止しています」
4. 既存のメール / Google ログインは通る
5. 戻すときは `"0"` にして再デプロイ

既定は `"0"`（開いている）。秘密ではない。

### 6.2 上限を下げる

| レバー | やり方 | いつ |
|---|---|---|
| 認識 | `AI_RECOGNIZE_DAILY_LIMIT` を 10000（許容上限 MAX）より小さく（env。無制限化しない） | Neurons / Gateway 支出 |
| 認識先 | 対象タスクのプロファイルを `workers-ai-llama` に戻す | Gemini の $ を止めたいとき |
| 写真枚数 | `PHOTO_UPLOAD_DAILY_LIMIT` を下げる（定数。同じ PR） | R2 Class A / 容量 |
| 写真サイズ | `PHOTO_OUTPUT_LONG_EDGE` / 品質を下げる（同じ PR。画面設計も直す） | R2 容量。最後の手段 |

### 6.3 Workers Paid を検討する

次の **いずれか**が 2 週続けて 80% 超、または 1 回でも枠到達でアプリが止まったとき。

- Workers リクエストまたは CPU
- D1 日次読取 / 書込
- R2 保存（バックアップ込み）が 8 GB 超で減らせない

やることは:

1. アカウントに支払い方法があることを確認する
2. Budget alert を付ける（目安 **5 USD**。情報のみ）
3. AI Gateway の spend limit を付ける（目安 **5 USD / 月**。こちらは 429 で止まる）
4. Workers Paid（月 5 USD）へ上げる
5. 月の上限を自分で決める。アラートは止めないので、再度 80% なら 6.1 に戻る

Paid にしても予算アラートはキャップではない。

---

## 7. オーナー作業（アラート）

値・メールアドレスの一覧を git に書かない。

### 7.1 Cloudflare Budget alert

Pay-as-you-go のみ。[Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)

1. Manage Account → Billing → Billable Usage
2. Create budget alert
3. 閾値はドル（例: 5）。受信はオーナーの請求メール
4. 発火しても使用は続く。6 章を実行する

無料プランのまま支払い方法が無いと、この画面が使えないことがある。そのときは週次目視が本線。

### 7.2 AI Gateway spend limits

[Spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/)

1. AI Gateway `default`（`AI_GATEWAY_ID`）
2. 月次のドル上限を付ける（例: 5）
3. 超過は 429。手入力は止めない（既存の認識エラー）

### 7.3 GitHub

リポジトリを **public のまま**にする（Actions の分が無料）。private にする判断が出たら、先に E2E の頻度を週次や `main` だけに落とす案を Issue にする。

---

## 8. 課金に進む判断基準（オーナー）

エージェントはデプロイも支払いもしない。オーナーが次を満たしたときだけ Paid にする。

1. 6.1 / 6.2 を試した、またはボット（8-05）を疑って WAF を見た
2. 無料枠到達でユーザーが記録できない状態が再現している
3. 月 5 USD を払う意思がある
4. Budget alert と Gateway spend limit を同じ週に入れる

満たさないなら登録停止のまま個人利用に戻す。

---

## 9. テスト

- `GET /api/health` の JSON キーは `ok` だけ。使用量らしきキーが無い
- `GET /api/config` に使用量キーが無い
- `SIGNUPS_CLOSED` 未設定 / `0` では従来どおり登録できる
- `1` のときメール登録は 400・ユーザーを作らない。Google の `requestSignUp` も 400
- 停止中も既存ユーザーのログインは 200
- 未認証の業務 API は 401 のまま
- 写真の長辺 1280 と 1 MiB 上限の定数が残っている
- wrangler 両 env の `SIGNUPS_CLOSED` 既定は `"0"`

---

## 10. 関連

- [02-tech-stack.md](../02-tech-stack.md)
- [operations.md](../operations.md) 9 章
- [monitoring.md](monitoring.md)
- [d1-backup.md](d1-backup.md)
- [rate-limit-abuse.md](rate-limit-abuse.md)
- [auth.md](auth.md)
- [photos.md](photos.md)
- [ai-recognition.md](ai-recognition.md)
- [password-reset.md](password-reset.md)
- [06-usage-monitoring.md](../../roadmap/phase-08-public-launch/06-usage-monitoring.md)
