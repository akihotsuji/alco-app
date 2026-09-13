# アカウント削除

実装: 2026-09-11。画面は [screen-designs/10-account-deletion.md](../screen-designs/10-account-deletion.md) と [06-settings.md](../screen-designs/06-settings.md) S16、[01-auth.md](../screen-designs/01-auth.md) A9。API は [api-design.md](../api-design.md) 4.2.2。データは [data-model.md](../data-model.md) 6.9〜6.12。

調査対象 main: `4d6df3c9efa0c1e63b350e74678560d9c7e8c6d6`。Better Auth は lockfile の 1.7.2。

## 1. 目的

設定から本人が退会できるようにする。削除受付確定後は取り消せない。全端末からの新たなアクセスを停止し、通常 DB のアカウントと所有データを削除する。R2 の写真本体は永続化した削除タスクから回収する。

## 2. 対象 / 対象外

**対象**

- 設定と年齢確認画面からの削除導線
- パスワード照合（メール認証）と Google 再ログイン（Google のみ）
- `POST /api/me/account-deletion`（年齢確認の対象外）
- D1 の原子的削除と R2 写真の非同期回収
- 写真アップロード予約（削除と put の競合）
- セッション Cookie キャッシュを保護 API で使わないこと
- 受付後画面 `/account-deleted`（公開 API は増やさない）
- プライバシーポリシーの削除手順更新
- バックアップ復元後の再削除手順

**対象外**

- 利用停止だけ / user 行だけ削除 / ブラウザからログアウトするだけ
- 復元猶予、退会理由、アンケート、引き留め、エクスポート新設
- ご意見・ご要望の本文と添付画像の削除（退会時は匿名化して残す。[feedback.md](feedback.md)）
- Better Auth 標準 `deleteUser.enabled` の公開（本人確認と写真予約を迂回できるため使わない）
- Google アカウント自体の削除、Google 側履歴の消去
- 未検証の完了時間を公開文言で保証すること
- 過去に生じた可能性のある孤児 R2 の一括消去（突合は運用点検）

## 3. 決定

| 項目 | 決定 | 根拠 |
|---|---|---|
| ルート | `/settings/account/delete`（認証必須・年齢確認不要）、受付後 `/account-deleted`（認証不要の SPA） | 設定からの専用画面。新しい公開 API は作らない |
| API | `POST /api/me/account-deletion`。202 `{ status: "accepted" }`。`Cache-Control: no-store` | 受付確定＝写真キー永続化と通常 DB 削除のコミット済み |
| 本人確認 | パスワード設定済みは現行パスワードを Better Auth `verifyPassword` で照合。Google のみはセッション `createdAt` が 5 分以内。`updatedAt` は使わない | 独自ハッシュ照合は作らない。5 分は今回の設計値 |
| 対象ユーザー | サーバーが確認したセッションの `user.id` のみ | URL / body の userId・メール・r2Key は使わない |
| Cookie キャッシュ | 保護 API の `getSession` は `disableCookieCache: true`。設定の `cookieCache.enabled` は false | 削除直後の署名付き Cookie で保護 API・写真配信を使えないようにする |
| 写真配信 | 今後の `GET /api/photos/:id/content` は `private, no-cache` | 端末保存は可。表示のたびに認可後再検証する。1 年 immutable には戻さない。既存レスポンスへの遡及はしない |
| R2 障害 | タイムアウト・5xx・権限障害は成功にしない。オブジェクト無しは成功 | 既存 photo-gc も同じ原則 |
| 独立台帳 | D1 outbox（`account_deletion_records`）を写真 R2 の `account-deletion-ledger/{userId}` へ転記 | 復元対象 D1 と独立。アプリ Worker にバックアップ SQL は読ませない |
| 保持 | 削除記録は最大復元可能期間＋余裕。設計上の目安はバックアップ 14 日＋ Time Travel 7 日。本番未確認は「全部 14 日以内」と書かない | [d1-backup.md](d1-backup.md) |

## 4. 画面と導線

正本は [10-account-deletion.md](../screen-designs/10-account-deletion.md)。

1. 設定アカウント節の「アカウントを削除」→ `/settings/account/delete`
2. 年齢確認（未完了・未満拒否）からも同じ画面へ。削除に年齢確認は要求しない
3. チェックと本人確認を終えたら「アカウントとデータを削除」
4. 202 なら `/account-deleted`。通信切断で受付成否が不明なら成功断定しない
5. キャンセル・戻るでは削除しない

## 5. 本人確認・認可

1. 削除対象はセッションの `user.id`
2. 削除直前は Cookie キャッシュに依存せず、DB 上の有効セッションとユーザーを確認する
3. `hasPassword` ならパスワード必須。間違い・無しは削除しない（403 `reauthentication_required`）
4. Google のみは Google 再ログイン。戻っても自動削除せず、最終ボタンを要求する。別アカウントで戻ったら手続きを破棄する
5. パスワード新設や削除確認メールは必須にしない
6. POST の `Origin` がリクエスト origin と一致しないときは削除しない。GET では削除しない
7. 本人確認試行と削除要求はユーザーあたり 10 分 5 回（メモリ。isolate 単位）
8. `user.deleteUser.enabled` は false のまま

`GET /api/me` は `{ id, email, name, ageVerified, hasPassword, hasGoogle }`。`account.password` は SELECT しない。`provider_id` だけ見る。

## 6. サーバー処理

### 6.1 受付（同一 D1 batch）

1. 削除要求 ID を作る
2. 当人の個人写真（`photos.user_id`）と、削除対象になる個人セラー／最後の 1 人の共有セラーのボトル写真キーを写真削除タスクへ `INSERT SELECT` する。**残す共有セラーの写真は回収しない**
2b. 共有セラーのオーナーで他メンバーがいるときは 409 `conflict`（`owner_required`）。通常メンバーは参加解除と登録者の匿名化だけ行い、共有ボトルは残す
3. 復元用の最小記録（`user_id` と削除日時。表示名・メール・飲酒内容は持たない）を outbox に作る
4. verification は `value = userId` または `identifier = email` の完全一致だけ削除する。部分文字列照合はしない
5. `user` を削除し、CASCADE で所有データと全セッションを消す

タスクと予約テーブルに user CASCADE は付けない。コミット前に R2 実体は消さない。Better Auth の beforeDelete / afterDelete に非原子的処理を置かない。

### 6.2 R2 削除

受付後にタスクを処理する。`waitUntil` は初回加速のみ。日次 `scheduled` が未完了を再実行する。

- 成功: R2 delete 成功、または既に存在しない。写真タスクは原本キーから派生（`{id}.thumb.jpg` / `{id}.thumb.png`）も消す
- 失敗: タイムアウト・5xx・権限。タスクを残しバックオフ再試行
- 成功後の D1 更新失敗でも再削除できる（冪等）
- 試行上限に達しても捨てない。24 時間超は監視対象
- ログは要求 ID・件数・状態・処理時間・エラー分類。メール、パスワード、Cookie、OAuth トークン、写真 URL、写真キー、飲酒内容は出さない

### 6.3 アップロード競合

R2 put 前に `photo_object_reservations` へ `r2_key` と `user_id` を永続化する。put 直前にユーザー存在と予約 lease を確認する。ユーザー削除後の遅延 put は予約が取れなければ書かない。認識結果のキャッシュは userId キーを消し、削除後の再保存を拒否する。

### 6.4 クライアント

受付成功後は Query をキャンセルしてキャッシュを捨て、複数タブへ通知する。アカウントに紐づく下書き・ガイド進捗・切り抜き診断・`cellar.selectedId`・招待トークンは捨てる。テーマ・触感・動き・写真既定など個人データを含まない端末設定は残す。`localStorage.clear()` はしない。

オフライン端末の画面や保存済み画像を遠隔で即消去する保証はしない。

## 7. バックアップ・復元

通常 DB / R2 の削除、バックアップの期限消去、外部サービスの保持、端末保存物は区別する。

| 保管 | 設計上の保持 | 本番確認 | 削除手段 |
|---|---|---|---|
| 通常 D1 | 受付コミットで即時 | 実装 | CASCADE + verification 完全一致 |
| 写真 R2 | 受付後にタスク。目標 24 時間以内 | 未実測 | タスク再試行 |
| D1 SQL バックアップ | 14 日（R2 lifecycle） | 適用はオーナー確認 | lifecycle。アプリは読まない |
| D1 Time Travel | Free 7 日 / Paid 30 日 | 2026-09-09 に両 D1 が対象 | 復元後に台帳を再適用 |
| Workers Logs | Cloudflare 側 | 未確認 | 運用の保持設定 |
| AI Gateway 本文ログ | 既定 OFF（`AI_GATEWAY_COLLECT_LOG=0`） | 設定値はリポジトリ上 OFF | ON のときだけ別途確認 |
| モデル提供者 | 委託先の条件 | 未確認 | アプリからは消えないことがある |
| 端末 HTTP キャッシュ / スクショ | 対象外 | — | 説明しない |

復元手順（正本は [operations.md](../operations.md) 5.4）:

1. 一時 D1 で中身を確認する。本番をいきなり上書きしない
2. 現行 D1 の未転記 outbox を R2 台帳へ回収できるか確認する。完全性を確認できないときは復元データを公開しない
3. 復元後、サービス再開前に台帳の `user_id` を再削除する。旧セッションは使えない
4. 未転記があれば再開しない

## 8. 通信切断・再登録

- コミット前失敗: 受け付けていない。画面に再試行
- コミット後に応答喪失: サーバーは継続。401 や再送で復元しない。画面は「通信が途切れたため、受付結果を確認できません」
- 同じメール / Google での再登録は新規 `user.id`。旧タスクは旧キーだけを扱う

## 9. テスト

[10 章の受け入れ](#10-受け入れ) と Vitest（サービス・失敗注入・ローカル D1 の原子性）、Playwright（メール認証の UI）。実 Google 再認証と本番保持設定は未実施としてレポートする。本番ユーザーは使わない。

## 10. 受け入れ

- [ ] メール認証・Google 認証それぞれで受付できる。誤パスワード、古いセッション、別 Google アカウント、キャンセルでは削除されない
- [ ] 年齢確認未完了でも本人確認後に削除できる
- [ ] 未認証、他人の ID 注入、不正 Origin、GET では削除できない
- [ ] ユーザー A を削除しても B の DB 行・R2 画像・セッションは完全に維持される
- [ ] 全対象テーブルが削除され、verification の当人分だけも削除される
- [ ] 写真ゼロ、未紐付けあり、photo/cutout 混在、バッチ上限超で完了できる
- [ ] D1 コミット失敗でアカウントだけ消えること、写真だけ消えることがない
- [ ] R2 タイムアウト・権限障害でタスクが残り、復旧後に再試行で完了する
- [ ] R2 成功後の D1 更新失敗、二重クリック、複数 Worker、途中終了でも削除漏れ・他人の削除がない
- [ ] 削除と写真アップロード／AI 処理が競合しても追跡不能の R2 実体やユーザーデータが残らない
- [ ] 削除前の通常 Cookie・キャッシュ Cookie を別端末から再利用しても新たな保護 API・写真配信を利用できない
- [ ] 受付応答の Cookie 失効がセッション更新 Cookie に上書きされない
- [ ] 戻る操作、PWA 再起動、タブ復帰、別アカウントログインで旧データが再表示されない
- [ ] 同じメールで再登録しても旧削除タスクに巻き込まれない
- [ ] バックアップを一時 DB へ復元し、削除記録の再適用で当人データが消える。旧セッションを再利用できない

## 11. 関連

- [auth.md](auth.md)
- [age-verification.md](age-verification.md)
- [photos.md](photos.md)
- [d1-backup.md](d1-backup.md)
- [legal.md](../legal.md)
- [operations.md](../operations.md)
- Better Auth 1.7.2 `verifyPassword` / `getSession({ disableCookieCache })` / `signOut`
- Cloudflare D1 `batch`
