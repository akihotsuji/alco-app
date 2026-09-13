# 利用規約・プライバシーポリシー（8-01）

実装: Phase 8-01。画面は [screen-designs/09-legal.md](../screen-designs/09-legal.md) / [01-auth.md](../screen-designs/01-auth.md) / [06-settings.md](../screen-designs/06-settings.md)。文面の正本は [legal.md](../legal.md)。データマップは同ファイル 2 章。手順は [roadmap/phase-08-public-launch/01-terms-privacy.md](../../roadmap/phase-08-public-launch/01-terms-privacy.md)。

- 状態: **草案**（2026-09-13。共有セラー・退会・ご意見・AI 照合・PWA を文面へ反映。再同意ゲートは作らない）。法的効力の確定と事業者表示（氏名・住所・連絡先）はオーナー承認。エージェントは構成・実装フック・個人情報の棚卸しまで
- 対象地域: **日本**（EU Cookie バナーは対象外）

---

## 1. 目的

一般公開に備え、利用規約とプライバシーポリシーを日本語で公開し、サインアップ時にサーバー強制の同意を取る。文面の法的責任はオーナー（必要なら専門家）。

---

## 2. 対象 / 対象外

**対象**

- データマップと草案（酒類・20 歳、免責、Cloudflare への国外移転、写真の権利、飲酒記録の扱い、共有セラー、退会、ご意見、AI 照合、PWA）
- 公開ページ `/terms` `/privacy`（認証なし。SPA ルート。新しい `/api/*` は増やさない）
- サインアップの同意 UI とサーバー検証（メール登録と Google 新規。8-04）
- 設定からの閲覧導線
- 同意の保存（アプリテーブル `legal_consents`）

**対象外**

- 弁護士の確定意見の代替
- Cookie バナー（EU 完全対応）。解析・広告 Cookie は使っていない
- 年齢確認フローの UI・API（8-02。[age-verification.md](age-verification.md)。本タスクは禁止条項と同意だけ）
- アカウント削除の実装詳細（[account-deletion.md](account-deletion.md)。本タスクは PP の案内文）
- 更新時の再同意ゲート（重大変更時は将来。8-01 は初回サインアップのみ）
- 英語版

---

## 3. 決定（8-01）

| 項目 | 決定 | 根拠 |
|---|---|---|
| 言語 | 日本語のみ | 公開対象はまず日本 |
| 事業者 | 公開ページは「本サービスの運営者（個人）」。氏名・住所・連絡先メールは **オーナー承認時に [legal.md](../legal.md) へ記入** | 個人情報保護法の公表事項。勝手に氏名を置かない |
| 公開ルート | `/terms` `/privacy`。ログイン前後どちらでも閲覧可。`GuestOnly` にも `RequireAuth` にも入れない | サインアップ・設定から辿る。ログイン済みを `/` に飛ばさない |
| 公開 API | 8-01 では増やさない。死活確認は `GET /api/health`。公開設定は 8-05 の `GET /api/config` | [api-design.md](../api-design.md) 2.3 |
| 同意の保存 | Better Auth の `user` は触らない。アプリテーブル `legal_consents`（`user_id` UNIQUE、版、`accepted_at`） | Auth CLI 生成物を手で ALTER しない。[data-model.md](../data-model.md) 6.7 |
| サーバー強制 | `POST /api/auth/sign-up/email` の before hook。`acceptedLegal === true` かつ `legalVersion` が現行版と一致しなければ拒否 | チェックをクライアントだけで迂回できない |
| 再同意 | 作らない。版と施行日を公開ページに出す。2026-09-13 の共有セラー反映でも既存ユーザーはロックしない。重大変更時の再同意は将来 | 要確認のまま実装しない |
| 既存ユーザー | 同意行が無くてもアプリは使える（個人利用で既に登録済みの移行） | 既存アカウントをロックしない |
| Cookie バナー | 置かない | セッション Cookie のみ。日本向け第一歩 |
| 飲酒記録 | 医療記録ではなく、利用者が任意に入れる生活記録。診断・治療には使わない | 健康隣接。専門家確認は残る |

---

## 4. 公開ページ

| ルート | 画面 ID | 認証 | 内容 |
|---|---|---|---|
| `/terms` | `legal-terms` | なし | 利用規約 |
| `/privacy` | `legal-privacy` | なし | プライバシーポリシー |

レンダリングは `src/shared/legal-documents.ts` の見出し・段落・箇条書きを React のテキストとして出す。`dangerouslySetInnerHTML` は使わない。Markdown の HTML 化もしない。

ヘッダーは戻る + タイトル。タブバーは出さない。キャラクターは出さない。

戻り: 履歴があれば戻る。無ければ `?from=signup|login|settings`。不正・無しは `/signup`。

---

## 5. サインアップ同意

クライアント（[01-auth.md](../screen-designs/01-auth.md) S7）:

- 必須チェック「利用規約とプライバシーポリシーに同意する」
- リンクはチェックのラベル外。`/terms?from=signup` と `/privacy?from=signup`
- 未チェックでは送信不可

サーバー:

- Better Auth `hooks.before`（`/sign-up/email`、および Google 新規の `/sign-in/social` + `requestSignUp`）
- ボディを `signupLegalAcceptanceSchema` で検証。失敗は 400。汎用文。内部パスは出さない
- 成功後 `databaseHooks.user.create.after` で `legal_consents` を 1 行入れる。版は **サーバー定数**（クライアント申告は一致確認だけ）
- Google 新規の同意は `additionalData`（8-04。[oauth-login.md](oauth-login.md)）

テストの `signUp()` ヘルパは現行版への同意を付ける。同意なしのケースは別テスト。

---

## 6. 設定

「このアプリ」節（ログアウトの下、版表記の上）:

- 利用規約 → `/terms?from=settings`
- プライバシーポリシー → `/privacy?from=settings`

---

## 7. テスト

- `signupLegalAcceptanceSchema`: 未同意・旧版は失敗
- 同意なし / `false` / 旧版のサインアップは 400。ユーザー行を作らない
- 同意ありは 200。`legal_consents` に自分の `user_id` と現行版が入る
- 公開ページはユーザー入力を HTML として埋め込まない（ソース検査）
- E2E のサインアップはチェックを入れてから登録する

---

## 8. 関連

- [legal.md](../legal.md) — データマップと草案（版 `2026-09-13`）
- [auth.md](auth.md)
- [shared-cellar.md](shared-cellar.md)
- [account-deletion.md](account-deletion.md)
- [ai-recognition.md](ai-recognition.md)
- [feedback.md](feedback.md)
- [pwa.md](pwa.md)
- [data-model.md](../data-model.md) 6.7
- [screens.md](../screens.md)
- [02-age-verification.md](../../roadmap/phase-08-public-launch/02-age-verification.md)
