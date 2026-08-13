# 7-06 独自ドメイン設定（任意）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **未着手（任意）** |
| 要件 | 当面 `*.workers.dev` でも可。独自ドメインは約 1,000〜2,000 円/年 |
| ソース | Phase 7 独自ドメイン |

## 1. 概要

読みやすい URL と Cookie の安定。やらなくても Phase 7 は完了できる。やる場合は HTTPS と Auth の `baseURL` / trustedOrigins を更新する。

## 2. 前提条件

- 本番 Worker（7-01, 7-02）
- ドメインを買うかはオーナー判断（**要確認**）
- DNS を Cloudflare にするのが最短

## 3. スコープ

**対象**

- ドメイン購入・DNS・Workers カスタムドメイン
- Better Auth baseURL 更新
- Cookie の Domain 属性が必要か確認

**対象外**

- メール（MX）— パスワードリセットは Phase 8
- マルチサブドメイン（www と apex のどちらを正にするかだけ決める）

## 4. 成果物

- 本番 URL がカスタムドメインまたは「workers.dev のまま」の明示
- 設定手順（値にアカウント秘密を書かない）

## 5. 細分化タスク

1. やる/やらないを決める
2. やるならドメイン名（**要確認**）
3. Workers にカスタムドメインを付ける
4. Auth 設定と CORS（同オリジン維持）
5. 旧 workers.dev をリダイレクトするか閉じるか。**要確認**（閉じると Cookie が別ホスト）

## 6. 手順

やらない場合: 本ファイルの受け入れは「workers.dev で本番稼働を確認し、roadmap に任意スキップと書く」。

やる場合: Cloudflare Dashboard の Workers カスタムドメイン公式手順。DNS プロキシ（オレンジ雲）。

```powershell
pnpm exec wrangler deploy --env production
```

証明書は Cloudflare が発行。

## 7. 仕様詳細

- 常時 HTTPS
- apex と www の二重登録で Cookie が割れるのを避ける
- PWA start_url と manifest の id を新オリジンに合わせる（再インストールが必要になりうる）

## 8. 受け入れ条件

- [ ] 方針が文書化されている（実施 or スキップ）
- [ ] 実施時: HTTPS でログイン〜記録ができる
- [ ] Auth の baseURL が新オリジン
- [ ] 秘密を書いていない

## 9. セキュリティ観点

- 誤って HTTP を残さない
- ドメイン取得サービスに登録したメールの 2FA はオーナー作業
- 証明書のメール検証フィッシングに注意（手順に「公式ダッシュボード以外のリンクを踏まない」）

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) コスト
- [03-secret-management.md](03-secret-management.md) は無関係だが baseURL は秘密ではない

## 11. リスク・注意点

- PWA を workers.dev で追加済みだとアイコンが別アプリになる
- ドメイン更新忘れで本番が死ぬ（リマインダ）
