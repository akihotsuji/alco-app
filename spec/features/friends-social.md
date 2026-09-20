# 友達・近況共有（friends-social）

友達限定の近況フィード。招待リンク／QRで申請し、相互承認した相手にだけ、記録・セラー登録・開栓の共有を見せる。

- 状態: **初版実装**（指示書 2026-09-20。記録統合は #171 到達後に接続）
- 画面の正本: [screen-designs/13-friends.md](../screen-designs/13-friends.md)。設定の追加行は [06-settings.md](../screen-designs/06-settings.md)
- 列: [data-model.md](../data-model.md) 6.15。API: [api-design.md](../api-design.md) 4.12
- 対象外: 返信、コメント、DM、独立投稿、リポスト、ハッシュタグ、ユーザー検索、連絡先同期、公開フォロー、外部SNS、プッシュ、競争、ポイント

## 接続確認（#171 統合後）

調査 SHA `79f7692` ではログとノートが別実装だった。作業開始時の `origin/main` は `968491d`（飲酒記録にテイスティングノートを統合）。本機能は統合を再実装しない。

| 概念 | 正本 |
|---|---|
| 統合記録 | `drink_logs` + 任意子 `tasting_notes`（1 記録 0..1）。作成・更新は `POST` / `PATCH /api/drink-logs` の `tastingNote` |
| 公開用ひとこと | `tasting_notes.taste`（一覧の「一言」）。`drink_logs.memo` は私的メモとして **自動公開しない** |
| 評価 / 詳細テイスティング | `rating_x10` / `appearance` `aroma` `taste` `finish`。存在するときだけ「詳しく見る」 |
| 記録写真 | `photos.drink_log_id`（1）と `photos.tasting_note_id`（≦6）。共有画像は投稿に現に含まれる ID だけ |
| セラー登録 | `POST /api/bottles`。`count` 展開と `/cellar/batch` は `registration_batch_id` で 1 投稿に集約 |
| 開栓 | `POST /api/bottles/:id/consume`。サーバーが `opening_events` を採番。sessionStorage は導線用のみ |
| 開栓→記録 | `log-new?from=opened&bottleId=&openingEventId=`。共有は最終選択後に `opening_with_log` 1 件 |
| 写真配信 | 既存 `GET /api/photos/:id/content` は所有者専用のまま。友達は `GET /api/social/posts/:postId/photos/:photoId/content` |
| ノート一覧 | `/notes` は残す。タブは友達に置換。設定「テイスティングノート」とボトル詳細 T6 から入る |
| 表示名 | Better Auth の `user.name` は公開しない。公開名は `social_profiles.nickname` |

## 1. 公開権限

受信対象は共有確定時の有効 `friendship_epochs` を `social_post_recipients` に固定する。閲覧は「本人、または受信行があり世代が現在有効、双方未ブロック、投稿と依存元が有効」。編集で受信者を増やさない。

友達成立日・飲酒日ではなく、共有のサーバー確定順。解除後の再承認で旧投稿は復活しない。

権限外と未存在は同じ 404。元のログ／ボトル API への友達アクセスは不可。共有セラー権限は付与しない。

## 2. 共有

設定「記録時の『友達に共有』を最初からオンにする」（既定 true、サーバー保存）。各操作のスイッチは設定を書き換えない。プロフィール未設定または友達 0 人では共有不可の説明だけ出し、個人保存は可能。

通常編集は未共有のまま。共有済みは許可項目の変更を追従（`published_at` / 受信者 / リアクション維持）。取消は投稿・反応・関連通知を削除し、元記録は残す。再共有は新しい `operationKey` の新規イベント。

公開項目はホワイトリスト投影のみ。量・アルコール量・価格・店名・座標・保管場所・個人メモ・認証名・メールは返さない。

保存成功＋共有失敗は「記録は保存しました。友達への共有に失敗しました」。同じ元 ID と操作キーで共有だけ再試行する。

## 3. リアクションと通知

マスタ 7 種（`like` / `delicious` / `want_to_try` / `surprised` / `celebrate` / `cheers` / `curious`）。API は DB の有効行を返す。1 人 1 投稿 1 種。自分の投稿には付けられない。

通知は `friend_request` / `friend_accepted` / `reaction` のみ。新規投稿通知は作らない。

## 4. アカウント削除

退会バッチでプロフィール・アバター R2・投稿・反応・友達・申請・招待・通知を既存フローに載せる。アバターの R2 は `account_deletion_photo_tasks` で再試行する。
