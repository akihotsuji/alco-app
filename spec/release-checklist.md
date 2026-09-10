# リリースチェックリスト（7-08）

初回および以降の本番リリースで、人が飛ばさない項目。1 ページ。値・トークン・本番セッションは書かない。

手順の実行順は [.cursor/skills/release/SKILL.md](../.cursor/skills/release/SKILL.md)。ロールバックは [operations.md](operations.md)。監査の正本は [security-audit-release.md](security-audit-release.md)。

- 状態: **チェックリスト作成済み**（2026-09-09）。コードゲートとドキュメントは実施済み。**初回本番デプロイと実機スモークはオーナー**

---

## 実施記録

| 日付 | 実施者 | 範囲 |
|---|---|---|
| 2026-09-09 | エージェント | 7-07 監査合格、ローカル lint / typecheck / test / `pnpm audit --audit-level=high`、本ファイルと release スキル。本番 URL の操作はしていない |

失敗したら次の節へ進まない。

---

## 事前条件

- [x] CI（lint / typecheck / test / e2e）が対象 commit でグリーンになること（ローカル 2026-09-09。マージ後は Actions の `CI`）
- [x] [security-audit-release.md](security-audit-release.md) が Critical / High ゼロ
- [x] 公開 API が `GET /api/health` と `/api/auth/*` だけ（`src/ci/security-release-gates.test.ts`）
- [x] 本番 `BETTER_AUTH_SECRET` 投入済み（7-03。dev と別値。値は残さない）
- [ ] GitHub Environment `production` に必須レビューアがある（[deploy-prod.md](features/deploy-prod.md)）
- [ ] 6-05 の実機確認をオーナーが了承している（[qa-devices.md](qa-devices.md)）

---

## デプロイ

- [ ] Actions → **Deploy prod** → `main`（またはタグ `vX.Y.Z`）→ Environment 承認
- [ ] ログに `workers.dev` URL が残っていない（`[redacted-url]`）
- [ ] 本番 migrate が deploy より前に成功している
- [ ] `GET https://sake-shiori.com/api/health` が `{ "ok": true }`
- [ ] www / 本番 `workers.dev` が apex へ 308（パス維持）

---

## 機能スモーク（本番ユーザー。dev と混ぜない）

- [ ] サインアップまたはログイン（メール＋パスワード。Google クライアント投入後は Google でも可。同じメールのパスワードユーザーは Google で入れない）
- [ ] 記録 1 件
- [ ] ボトル 1 件
- [ ] ノート 1 件
- [ ] 自分の写真だけ見える
- [ ] PWA をホームに追加（推奨。Phase 7 DoD）

---

## セキュリティ / 監視 / バックアップ

- [ ] ダッシュボードで写真 R2 とバックアップ R2 の Public Development URL が Disabled、カスタムドメインが空
- [ ] ブラウザで API 応答に CSP / nosniff / `X-Frame-Options: DENY` がある
- [ ] Workers Observability が `alco-app-prod` で見える（[monitoring.md](features/monitoring.md)）
- [ ] `ALERT_WEBHOOK_URL` を入れるなら投入済み。未設定なら Logs のみで可
- [ ] **Backup D1** を `mode=backup` で 1 回。続けて `mode=rehearse`（prod / dev を上書きしない）
- [ ] [operations.md](operations.md) のロールバックを声に出して確認する（実行はしない）

---

## 完了条件

- 本番 URL でアプリが動き、dev の D1 / R2 を見ていない
- 上のデプロイ・スモーク・R2・バックアップが付いている
- 失敗時は [operations.md](operations.md) に戻る。dev のテスト用パスワードを本番に使い回さない
