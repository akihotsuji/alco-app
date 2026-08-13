# 7-03 シークレット管理の整理

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **未着手** |
| 要件 | wrangler secret / GitHub Secrets、`.dev.vars` コミット禁止 |
| ソース | Phase 7 シークレット管理 |

## 1. 概要

秘密の置き場を一覧化し、コード・spec・roadmap に値が無いことを保証する。値そのものはこのファイルに書かない。

## 2. 前提条件

- 認証・R2・デプロイが存在する
- `.gitignore` に `.dev.vars`

## 3. スコープ

**対象**

- 秘密のインベントリ（**キー名のみ**）
- 環境ごとの投入手順
- ローテーション方針
- `.dev.vars.example` の同期

**対象外**

- 実際の秘密値
- 1Password 等の必須化（任意。**要確認**）

## 4. 成果物

- `spec/secrets.md` または operations の一節（値なし）
- example ファイル
- git history に誤コミットが無いかの確認手順（あったら無効化が先）

## 5. 細分化タスク

1. キー一覧（BETTER_AUTH_SECRET、CLOUDFLARE_API_TOKEN、将来の Sentry DSN は公開でもよいものがある。DSN は **要確認**）
2. どこに置くか表（local / dev worker / prod worker / GitHub）
3. `git ls-files` で `.dev.vars` が無いこと
4. 誤ってコミットした場合の対応（secret 無効化、gitignore、履歴は force せず当面ローテーション）

## 6. 手順

```powershell
git ls-files "*.dev.vars" ".env"
rg -n "sk_|BEGIN PRIVATE|BETTER_AUTH_SECRET=" --glob "!roadmap/**" --glob "!spec/**"
```

ヒットしたら値かどうか目視。example の空キーは可。

投入:

```powershell
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
```

GitHub: Settings → Secrets and variables → Actions。

## 7. 仕様詳細

| キー | local | Workers dev | Workers prod | GitHub |
|---|---|---|---|---|
| BETTER_AUTH_SECRET | .dev.vars | wrangler secret | wrangler secret | 不要（デプロイしない） |
| CLOUDFLARE_API_TOKEN | 使わない（wrangler login） | - | - | Actions |

Auth secret は環境ごとに変える（dev 漏洩が本番セッションを割れない）。

## 8. 受け入れ条件

- [ ] キー名一覧がある
- [ ] `.dev.vars` が git に含まれない
- [ ] コードに秘密値がない
- [ ] 本番と dev で Auth secret が別（オーナー確認。値は見せない）

## 9. セキュリティ観点

security.mdc シークレット節そのもの。ログ禁止、spec 禁止。

## 10. 関連ファイル / 関連spec

- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc)
- [02-deploy-pipeline.md](02-deploy-pipeline.md)

## 11. リスク・注意点

- エージェントがユーザーから secret を聞いて issue に書く
- example に実値を「サンプル」として残す
