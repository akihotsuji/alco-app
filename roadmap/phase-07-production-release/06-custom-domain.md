# 7-06 独自ドメイン設定

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **ゾーン接続済み**（2026-09-09）。308 は Deploy prod 後 |
| 要件 | 本番を `https://sake-shiori.com` にする。dev の `workers.dev` は残す |
| ソース | Phase 7 独自ドメイン。正本は [spec/features/custom-domain.md](../../spec/features/custom-domain.md) |

## 1. 概要

公開名称は **さけしおり**。正ホストは apex。www と本番 `workers.dev` は正へ 308。dev は開発用 `workers.dev` のまま。

## 2. 前提条件

- 本番 Worker（7-01, 7-02）と本番 Auth secret（7-03）
- Cloudflare アカウント（dev と同じ）
- `sake-shiori.com` の Registrar 購入（支払い・登録者情報・約款はオーナー）

## 3. スコープ

**対象**

- ドメイン名・正ホストの決定
- `wrangler.jsonc` の本番カスタムドメインと `CANONICAL_ORIGIN`
- Worker でのホスト正規化
- Better Auth `baseURL`

**対象外**

- dev のカスタムドメイン
- 本番 `workers.dev` の無効化
- メール（MX）
- 画面表示名の差し替え（さけしおり。表示名タスクで実施）

## 4. 成果物

- [spec/features/custom-domain.md](../../spec/features/custom-domain.md)
- 本番 routes / `CANONICAL_ORIGIN` / 308 リダイレクト

## 5. 細分化タスク

1. 実施する（済み）
2. 名前は さけしおり / `sake-shiori.com`（済み）
3. Workers カスタムドメインは `wrangler.jsonc` に書いた。ゾーン作成後の Deploy prod で付く
4. Auth は `CANONICAL_ORIGIN`（同オリジン維持）
5. 本番 `workers.dev` はリダイレクト。閉じない。dev はそのまま

## 6. 手順

1. Cloudflare Registrar で `sake-shiori.com` を買う（ダッシュボードの決済）
2. 公式ダッシュボード以外の証明書メールは開かない
3. `main` マージ後に Deploy prod を承認する

```powershell
pnpm exec wrangler deploy --env production
```

証明書は Cloudflare が発行。ゾーンが無いとカスタムドメイン付与は失敗する。

## 7. 仕様詳細

正本は [spec/features/custom-domain.md](../../spec/features/custom-domain.md)。

- 常時 HTTPS
- Cookie に `Domain` を付けない
- PWA の `start_url` は `/`。新オリジンではホーム追加し直し

## 8. 受け入れ条件

- [x] 方針が文書化されている（実施）
- [ ] 実施時: HTTPS でログイン〜記録ができる（購入と Deploy prod のあと）
- [x] Auth の baseURL が新オリジン（`CANONICAL_ORIGIN`）
- [x] 秘密を書いていない

## 9. セキュリティ観点

- HTTP は 308 で HTTPS へ
- 登録メールの 2FA はオーナー作業
- 証明書のメール検証フィッシングに注意（公式ダッシュボード以外のリンクを踏まない）
- リダイレクト先 origin は設定値のみ

## 10. 関連ファイル / 関連spec

- [spec/features/custom-domain.md](../../spec/features/custom-domain.md)
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) コスト
- [03-secret-management.md](03-secret-management.md) は無関係。`CANONICAL_ORIGIN` は秘密ではない

## 11. リスク・注意点

- PWA を本番 `workers.dev` で追加済みだとアイコンが別アプリになる
- ドメイン更新忘れで本番が死ぬ（リマインダ）
- ゾーン未作成のまま Deploy prod するとカスタムドメイン付与が失敗する
