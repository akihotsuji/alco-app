# 年齢確認（20 歳以上）

実装: Phase 8-02。画面は [screen-designs/01-auth.md](../screen-designs/01-auth.md) の `auth-age`。手順は [roadmap/phase-08-public-launch/02-age-verification.md](../../roadmap/phase-08-public-launch/02-age-verification.md)。収集項目は [legal.md](../legal.md) 2 章と一致させる。

- 状態: **実装**（2026-09-10）。法務上の満 20 歳の定義は本ファイル 3 章。eKYC は対象外
- 対象地域: **日本**（飲酒年齢の地域自動切替はしない）

---

## 1. 目的

酒類に関する記録サービスとして、**満 20 歳未満が本機能を使えない**ようにする。判定の正はサーバー。クライアントの `isOver20` は信じない。

---

## 2. 対象 / 対象外

**対象**

- ログイン後・初回アクセス時の確認 UI（`/age`）
- 生年月日の入力と、Asia/Tokyo 当日でのサーバー計算
- `user` に紐づく確認済みフラグ（セッションだけに持たない）
- 未確認時の機能 API 拒否（403）
- 20 歳未満の拒否画面
- 既存アカウントの一度だけの確認

**対象外**

- eKYC、免許証アップロード（身分証は R2 に置かない）
- 地域ごとの飲酒年齢の自動切替
- 確認後の生年月日の変更・再提出
- 公開（認証なし）の確認 API
- 管理フラグによるスキップ

---

## 3. 決定（8-02。ロードマップの要確認を落とす）

| 項目 | 決定 | 根拠 |
|---|---|---|
| 強度 | **生年月日**（`YYYY-MM-DD`）。チェックボックスだけは使わない | ロードマップ推奨。自己申告でも日付計算の方が強い |
| 満 20 歳 | 日本の年齢計算（出生当日算入。20 年の期間は 20 歳の誕生日の前日に満了）。JST のカレンダー日で比較 | 年齢計算ニ関スル法律 / 民法 143 条。法務の最終確定はオーナー |
| タイムゾーン | 「今日」は `tokyoToday()`（Asia/Tokyo） | 日付境界の正 |
| 保存 | アプリテーブル `age_verifications`（`user_id` PK）。Better Auth の `user` は触らない | 8-01 の `legal_consents` と同じ。Auth CLI 生成物を ALTER しない。生年月日をセッションに載せない |
| 成功時だけ保存 | 20 歳以上のときだけ行を作る。未満では生年月日を残さない | 未成年の要配慮情報を持たない |
| 変更 | 確認済みのあと POST しても 200 で無視（生年月日は上書きしない） | 確認後の改ざんを防ぐ。誤入力のやり直しは確認前だけ |
| 既存ユーザー | **一度だけ確認**。スキップフラグは持たない | 個人利用のオーナーも同じ画面を一度通る |
| HTTP | 未確認の機能 API は **403** `age_required`。未満の提出は **403** `age_restricted`。451 は使わない | ユーザー列挙をしない。IDOR の 404 方針とは別（リソースの存否ではない） |
| 公開 API | **増やさない**。確認 API はセッション必須 | [api-design.md](../api-design.md) 2.3 |
| レスポンス | `GET /api/me` は `ageVerified` に加え認証手段フラグ（`hasPassword` / `hasGoogle`）。`birthOn` は返さない | 露出を最小にする。削除 UI は手段だけ見る |
| ログ | 生年月日・計算途中の日付をログに出さない | 要配慮になりうる |
| PP | 生年月日と確認日時をデータマップへ追加。版を `2026-09-10` に上げる | 8-01 受け入れ「PP と項目が一致」。再同意ゲートは 8-01 どおり作らない |

---

## 4. 満 20 歳の計算

入力 `birthOn` と JST 当日 `today` はどちらも `YYYY-MM-DD`。実在しない日（`2026-02-30` 等）は 400。

```
majorityOn = addCalendarDays(addCalendarYears(birthOn, 20), -1)
isAtLeast20 = today >= majorityOn
```

`addCalendarYears` で 2 月 29 日生まれの非閏年は **2 月 28 日**に丸める（その月の末日）。

| 生年月日 | JST 当日 | 結果 |
|---|---|---|
| 2006-04-01 | 2026-03-30 | 未満 |
| 2006-04-01 | 2026-03-31 | 満 20 歳（誕生日前日） |
| 2006-04-01 | 2026-04-01 | 満 20 歳 |
| 2006-09-10 | 2026-09-09 | 満 20 歳 |
| 2006-09-11 | 2026-09-09 | 未満 |
| 2004-02-29 | 2024-02-27 | 未満 |
| 2004-02-29 | 2024-02-28 | 満 20 歳 |
| 未来日 | 当日 | 400 |
| 1900 年より前 | — | 400 |

クライアントが同じ式でボタンを無効化しても、**サーバーが再計算する**。

---

## 5. データ

テーブル `age_verifications`（[data-model.md](../data-model.md) 6.8）。1 ユーザー 1 行。

| 列 | 説明 |
|---|---|
| `user_id` | PK。セッションの `user.id`。CASCADE |
| `birth_on` | 確認に使った生年月日（`YYYY-MM-DD`） |
| `verified_at` | 確認成功の瞬間（UTC ms）。サーバー付与 |
| `created_at` / `updated_at` | |

行がある = 確認済み。行が無い = 未確認。拒否（未満）では行を作らない。

---

## 6. API

認証必須。公開リストには載せない。

| 方法 | パス | 年齢確認 | 概要 |
|---|---|---|---|
| GET | `/api/me` | 不要 | `{ id, email, name, ageVerified, hasPassword, hasGoogle }`。`birthOn` なし |
| POST | `/api/me/age-verification` | 不要 | `{ birthOn }`。成功 `{ ageVerified: true }` |
| POST | `/api/me/account-deletion` | 不要 | 本人退会。年齢確認の成否に依存しない。[account-deletion.md](account-deletion.md) |
| * | 記録・セラー・ノート・写真・マイドリンク | **必須** | 未確認は 403 `age_required` |
| * | `/api/auth/*` | 不要 | ログアウト・表示名更新は可 |
| GET | `/api/health` | 不要 | 公開のまま |
| * | 未定義の `/api/*` | 必須 | 未確認は 403（ルートの存在を漏らさない）。確認済みは 404 |

年齢確認ゲートは **確認済み userId を isolate 内に最大 1000 件**覚える（FIFO。`createVerifiedUserCache`）。確認は一度成立したら取り消す経路が無い（`age_verifications` に DELETE が無く、ユーザー削除は CASCADE でセッションも消える）ため、肯定結果の再利用は安全。**未確認（否定）は覚えない**ので、確認 POST の直後から機能 API が通る。効果は [performance.md](performance.md) 6.4。

`POST /api/me/age-verification`:

| 条件 | 応答 |
|---|---|
| 未認証 | 401 `unauthorized` |
| 形式不正・未来・1900 年より前 | 400 `validation_error`（`fields.birthOn`） |
| 満 20 歳未満 | 403 `age_restricted`。保存しない |
| 満 20 歳以上（初回） | 200 `{ ageVerified: true }`。行を作る |
| 既に確認済み | 200 `{ ageVerified: true }`。本文は無視 |

ボディに `userId` / `isOver20` / `ageVerified` を置かない。未知キーは 400。

---

## 7. 画面と遷移

正本は [01-auth.md](../screen-designs/01-auth.md) `auth-age`。

- 生年月日の入力は 年 / 月 / 日 の 3 欄（数字キーボード）。`type=date` は使わない（2026-09-10。カレンダーで数十年戻す操作が入れづらいため）。クライアントは 3 欄を `YYYY-MM-DD` に組んで送るだけで、20 歳判定はしない（`src/client/lib/birth-on-input.ts`）

1. サインアップ成功 → `/age`（`redirect` があれば引き継ぐ）
2. ログイン成功 → 元の `redirect` または `/`。未確認ならクライアントが `/age?redirect=` へ
3. 確認済みが `/age` に来たら `redirect` または `/`
4. 未満 → 同じ `/age` の拒否状態。生年月日の修正とログアウト
5. 確認中・拒否の両方から「アカウントを削除」へ辿れる。削除に年齢確認は要求しない
6. ログアウトは `endSession`。タブバーは出さない

---

## 8. テスト

- `isAtLeastAge` の境界（誕生日前日、閏日、未来日）
- 未確認の `POST /api/drink-logs` は 403 `age_required`
- 確認後は 201
- 未満の提出は 403 `age_restricted`。行が無い
- 未認証は 401。`birthOn` を応答に出さない
- 既存の API テストは `createTestUser` が確認済みにする
- E2E のサインアップは生年月日を入れてからホームへ

---

## 9. 関連

- [legal.md](../legal.md) / [features/legal.md](legal.md)
- [auth.md](auth.md)
- [api-design.md](../api-design.md) 2.6 / 4.2
- [data-model.md](../data-model.md) 6.8
- [screens.md](../screens.md)
