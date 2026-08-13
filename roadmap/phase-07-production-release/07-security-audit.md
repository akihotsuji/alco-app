# 7-07 リリース前の全体セキュリティ監査

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **未着手** |
| 要件 | 全 API 認証認可、ヘッダー、シークレット、R2 公開設定 |
| ソース | Phase 7「security-audit スキルをコードベース全体に対して実施」 |

## 1. 概要

差分ではなく **リポジトリ全体** を security-audit チェックリストで見る。Critical/High ゼロがリリースゲート。

## 2. 前提条件

- 機能コードが揃っている
- [.cursor/skills/security-audit/SKILL.md](../../.cursor/skills/security-audit/SKILL.md)
- 本番 R2 のダッシュボードを見る権限（オーナー）

## 3. スコープ

**対象**

- 全 `/api` ルートの MW
- 全 DB クエリの userId
- Zod 漏れ
- XSS、href
- シークレット、`.dev.vars`
- R2 公開設定、アップロード検証
- エラー本文
- 依存 `pnpm audit`
- 公開エンドポイントが仕様どおりか

**対象外**

- ペネトレーションツールでの攻撃 PoC 作成（禁止。チェックリストとコードレビュー）
- 第三者バグバウンティ

## 4. 成果物

- 監査レポート（PR または `spec/security-audit-release.md`）。スキルの報告フォーマット
- 指摘の修正 PR
- 再監査で Critical/High ゼロ

## 5. 細分化タスク

1. `src/server` のルート一覧を表にする
2. 各 GET/POST/PATCH/DELETE にテストの 401/404 があるか
3. R2 ダッシュボード確認（オーナー）
4. CSP / secure-headers
5. レポート
6. 修正と再監査

## 6. 手順

スキルの手順どおり。全体なので `git ls-files src` から見る。

```powershell
pnpm audit --audit-level=high
rg -n "dangerouslySetInnerHTML" src
rg -n "body.userId" src
rg -n "sql`" src
```

ヒットは一件ずつ判断。

公開例外リストと実装の allowlist を突き合わせる。

## 7. 仕様詳細

判定: スキルどおり Critical 1 件でリリース不可。

よくある抜け:

- 写真 GET が MW の後回し
- health が環境変数を返す
- wrangler の preview が認証なし

## 8. 受け入れ条件

- [ ] 全体監査レポートがある
- [ ] Critical/High ゼロ
- [ ] R2 非公開を確認した記録（オーナー）
- [ ] 公開エンドポイントが仕様と一致
- [ ] audit が High 以上で落ちない

## 9. セキュリティ観点

このタスク自体がセキュリティ。攻撃手順をレポートに書かず、修正方針を書く。

## 10. 関連ファイル / 関連spec

- [.cursor/skills/security-audit/SKILL.md](../../.cursor/skills/security-audit/SKILL.md)
- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc)
- [08-release-checklist.md](08-release-checklist.md)

## 11. リスク・注意点

- 「個人用だから」と IDOR テストを省略しない（将来公開と URL 漏洩）
- レポートに本番 URL + セッションを貼らない
