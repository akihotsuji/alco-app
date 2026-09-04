# 4-04 写真アップロード（R2・署名付き配信）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | クライアントリサイズ後保存。Phase 5 再利用 |
| ソース | Phase 4 写真アップロード |

## 1. 概要

画像のみを R2 に保存し、認可付きで配信する基盤。ボトルに 1 枚（または仕様の枚数）付ける。キーはサーバー生成。バケットは非公開。

## 2. 前提条件

- 0-03 の R2 バインディング `PHOTOS`
- cellar.md のサイズ・MIME
- Phase 2 認証

## 3. スコープ

**対象**

- クライアント側リサイズ（canvas 等）
- POST アップロード、サーバー MIME/サイズ検証
- ランダムキー
- 認可付き GET（`/api/photos/:id/content`。1-05）
- ボトルとの紐付け
- 「他ユーザーが URL を当てても見えない」テスト

**対象外**

- ノート複数枚の UI（5-03。API は流用）
- 公開 CDN
- EXIF 位置情報の取り扱い方針は含める（**要確認**: リサイズ時に EXIF を落とす推奨）

## 4. 成果物

- `src/client` リサイズユーティリティ + テストできる純粋部分
- `src/server` photos ルート
- R2 put/get
- ボトル詳細のサムネ
- API テスト（401、他人 404、image/jpeg 以外 400、過大サイズ 400）

## 5. 細分化タスク

1. 上限を決める（提案: リサイズ後長辺 1280、JPEG quality 0.8、サーバー上限 500KB。**要確認**）
2. 許可 MIME: `image/jpeg` `image/png` `image/webp`。GIF/SVG は SVG XSS 回避のため **拒否推奨**
3. キー: `photos/{userId}/{uuid}.jpg` は userId がキーに出る。**userId をキーに含めず uuid のみ + DB で所有** の方が列挙耐性あり。**要確認**
4. 配信: **認可付き GET `/api/photos/:id/content`**（1-05 確定。署名 URL は MVP 不採用）
5. 削除時 R2 も消す（失敗時の孤立オブジェクト掃除は後回し可。**要確認**）
6. 監査（アップロード項目 High）

## 6. 手順

ブランチ: `feature/photo-r2`

サーバーは Content-Type とバイト長を **クライアント申告ではなく実体** で見る。magic bytes までやるかは **要確認**（推奨）。

```powershell
pnpm test
# ローカル wrangler の R2 シミュレータで put/get
```

本番バケットを public にしない。ダッシュボード確認を手順に含める。

## 7. 仕様詳細

security.mdc どおり:

- サーバー検証を信用。クライアントリサイズは UX とコスト
- ファイル名をキーに使わない
- 配信に認可

並行アップロード数、1 ユーザーの枚数上限（無料枠 10GB）。個人なら緩くてよいが上限は設ける。**要確認**（例 1000 枚）。

## 8. 受け入れ条件

- [ ] 写真付き登録ができる
- [ ] R2 にオブジェクトがある
- [ ] 他ユーザーアクセス不可がテストされている（Phase 4 DoD）
- [ ] SVG 等危険タイプを拒否
- [ ] シークレットなし、バケット非公開
- [ ] DoD 5 項

## 9. セキュリティ観点

チェックリスト（security-audit アップロード節）を全項目パス。

- 存在しない写真と権限なしは 404
- 配信は認可付き GET。署名 URL は MVP では出さない
- ログに画像バイト列を出さない

## 10. 関連ファイル / 関連spec

- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc) ファイルアップロード
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) R2
- Phase 5: [../phase-05-tasting-note/03-multi-photo-attach.md](../phase-05-tasting-note/03-multi-photo-attach.md)

## 11. リスク・注意点

- iOS の HEIC。許可するか JPEG 変換必須か。**要確認**（変換はクライアントが重い）
- ワーカーのリクエストサイズ制限
- 認可 GET の URL を共有しても、他人の Cookie では 404
