# 8-05 レート制限・不正利用対策

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 8 一般公開準備 |
| ステータス | **未着手** |
| 要件 | 公開時のボット・総当たり。Better Auth のログイン制限は Phase 2 で有効化済み想定 |
| ソース | Phase 8「Cloudflare WAF / Turnstile」 |

## 1. 概要

オープン登録後の濫用を、Cloudflare の機能で抑える。アプリ側の独自キャプチャ実装は Turnstile ウィジェットに留める。

## 2. 前提条件

- カスタムドメインがあると WAF が使いやすい（**要確認**。workers.dev の制限）
- 8-03 の直前または直後
- 無料枠の WAF ルール数

## 3. スコープ

**対象**

- Turnstile（サインアップ・ログイン）
- WAF または Rate limiting ルール（`/api/auth`、POST 全般）
- 写真アップロードの回数制限
- 仕様への公開（ボット対策の存在。閾値の詳細は出しすぎない）

**対象外**

- 有料 Bot Management の必須化
- 攻撃者向けの回避解説

## 4. 成果物

- Turnstile のサイトキー（公開）とシークレット（wrangler secret）
- WAF ルール（ダッシュボード。コードに出せない場合は operations に「場所」だけ）
- テスト: トークンなしサインアップが失敗
- 依存最小（Turnstile はスクリプト。CSP 更新必須）

## 5. 細分化タスク

1. CSP に Turnstile ドメインを追加
2. サインアップにウィジェット
3. サーバー検証（秘密鍵。クライアント成功を信じない）
4. WAF レート（例: IP あたり POST /api/auth 分あたり上限。数値は **要確認**）
5. アップロード回数
6. 監査

## 6. 手順

Cloudflare Turnstile 公式 + Better Auth のフックまたは自前 MW でトークン検証。

WAF はダッシュボード。誤って全世界ブロックしない。まずログモード。

ブランチ: `feature/turnstile-rate-limit`

## 7. 仕様詳細

- ログイン失敗のメッセージは列挙しない（Phase 2 と同じ）
- IPv6 / 共有 NAT で正規ユーザーが当たる → 閾値は緩めで開始
- Turnstile 失敗時の代替（アクセシビリティ）**要確認**

## 8. 受け入れ条件

- [ ] サインアップにボット対策がある
- [ ] サーバー側検証がある
- [ ] CSP が更新されている
- [ ] 秘密が git に無い
- [ ] 正規のオーナーがログインできる（誤ブロックなし）
- [ ] 監査

## 9. セキュリティ観点

- Turnstile シークレットをクライアントに出さない
- レート制限をクライアントヘッダでバイパスできない
- WAF のバイパス IP を広くしない

## 10. 関連ファイル / 関連spec

- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc) レート制限（Better Auth）
- [03-open-signup-password-reset.md](03-open-signup-password-reset.md)
- [../phase-02-platform/03-hono-api-structure.md](../phase-02-platform/03-hono-api-structure.md) CSP

## 11. リスク・注意点

- CSP と Turnstile の相性でログイン画面が白
- 厳しすぎるレートで自分をロックアウト。operations に解除手順
