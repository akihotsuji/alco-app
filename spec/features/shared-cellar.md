# セラー共有

家族・カップルが、一つのセラー在庫をそれぞれのアカウントで共同管理する。ボトルの正本は 1 行 = 1 本。ユーザーごとのコピー同期はしない。

- 状態: 実装（2026-09-11。調査 SHA `97db2b0e7093c4d571210e7a00e76dbccdd6cf13`）。本番の `0010_shared_cellar` 適用で既存ボトル写真が消えた。原因と復旧は [operations.md](../operations.md) 10 章
- 画面の正本: [screen-designs/04-cellar.md](../screen-designs/04-cellar.md)、[screen-designs/11-shared-cellar.md](../screen-designs/11-shared-cellar.md)
- API の正本: [api-design.md](../api-design.md) 4.8
- 列の正本: [data-model.md](../data-model.md) 6.13〜
- 既存セラー: [cellar.md](cellar.md)。写真: [photos.md](photos.md)。退会: [account-deletion.md](account-deletion.md)

---

## 1. 目的

| ゴール | 内容 |
|---|---|
| 共同在庫 | 参加者が同じボトルを追加・編集・削除・開栓・復元できる |
| アカウント分離 | ログインを共有しない。個人の飲酒記録・ノート・評価・集計は共有しない |
| 既存体験の維持 | 下部タブは増やさない。棚・貯蔵庫・FAB・テーマ・キャラは既存のまま |

**境界:** 共有ボトルのメモ・購入価格・保管場所・写真は参加者全員に見える。個人の感想はテイスティングノートに残す。

---

## 2. 対象 / 対象外

**対象**

- 各ユーザー 1 つの個人セラー（既存ボトルはここへ移行）
- 1 ユーザーにつき共有セラー参加は 1 つまで（個人セラーと併用可）
- オーナーを含め最大 6 人。権限はオーナー / メンバーの 2 種
- 招待リンク（1 リンク 1 人、24 時間）、参加確認、除名、脱退
- 名称変更、所有権移譲（相手の承諾）、共有セラー削除
- 個人セラーから共有へのボトル移動（コピーではない。最大 50 本 / 回）
- ボトル `version` による競合検出、操作キーによる冪等
- セラー `revision` の 5 秒ポーリング

**対象外（初期版）**

- 閲覧専用権限、公開セラー、SNS、チャット、プッシュ通知
- 項目別公開設定、オフライン書き込み同期、複数共有グループ
- 共有ボトルの個人セラーへの持ち出し、脱退時の自動返却
- 削除 undo / ゴミ箱、WebSocket

---

## 3. 用語

| 用語 | 意味 |
|---|---|
| セラー | アクセス権のまとまり。`cellars` の 1 行。個人または共有 |
| 保管場所 | ボトルの `storage`（「自宅セラー」「冷蔵庫上段」）。参加グループではない |
| 個人セラー | 各ユーザー 1 つ。名称は「自分のセラー」。既存データはここ |
| 共有セラー | 招待で参加する在庫。名称は 1〜30 文字 |
| オーナー | 招待・除名・名称変更・移譲・セラー削除ができる。ボトル操作もできる |
| メンバー | 全ボトルの追加・編集・削除・開栓・復元・種類内の並び替えができる。管理操作は不可 |
| revision | セラーの変更世代。ボトル CRUD・写真・参加者・設定・種類内の並び替えで進む |
| version | ボトルの整数世代。更新・写真・開栓・復元・移動・削除の条件 |

---

## 4. 定数

| 定数 | 値 |
|---|---|
| `CELLAR_MEMBER_LIMIT` | 6（オーナー含む） |
| `CELLAR_NAME_MAX` | 30 |
| `CELLAR_DEFAULT_SHARED_NAME` | `共有セラー` |
| `CELLAR_PERSONAL_NAME` | `自分のセラー` |
| `CELLAR_NAME_CHIPS` | `ふたりのセラー` / `家族のセラー` |
| `CELLAR_INVITE_TTL_MS` | 24 時間 |
| `CELLAR_INVITE_PENDING_MAX` | 10（未使用かつ未失効） |
| `CELLAR_TRANSFER_TTL_MS` | 24 時間 |
| `CELLAR_MOVE_MAX` | 50 |
| `CELLAR_REVISION_POLL_MS` | 5_000 |
| `CELLAR_ACTIVITY_TTL_MS` | 30 日 |
| `CELLAR_IDEMPOTENCY_TTL_MS` | 24 時間 |
| `CELLAR_INVITE_CREATE_RATE` | 10 / 時間 / ユーザー |
| `CELLAR_INVITE_USE_RATE` | 20 / 10 分 / ユーザー |
| `CELLAR_CREATE_RATE` | 5 / 時間 / ユーザー |

---

## 5. 権限

| 操作 | オーナー | メンバー | 非メンバー |
|---|---|---|---|
| ボトル閲覧・追加・編集・削除・開栓・復元・種類内の並び替え | 可 | 可 | 404 |
| 写真 GET / 304 / 差し替え（ボトル写真） | 可 | 可 | 404 |
| 名称変更・招待発行 / 無効化・除名・セラー削除 | 可 | 不可（404） | 404 |
| 脱退 | 他メンバーがいれば不可（先に移譲または削除） | 可 | 404 |
| 所有権移譲の申請 / 取消 | 可 | 不可 | 404 |
| 所有権移譲の承諾 | — | 対象者のみ | 404 |
| 自分のボトルを共有へ移す | 可 | 可 | 404 |

認可はセッションの `user.id` と有効 membership。ボディや URL の userId / セラー所有宣言は信用しない。最終書き込み SQL に membership 条件を含める。非存在と権限なしは同じ 404。409 の詳細を返す前にも権限を検証する。

個人記録・ノートの `user_id` 条件は外さない。変えられるのは「参照できるボトル」の条件だけ。

---

## 6. 画面と導線

詳細は [11-shared-cellar.md](../screen-designs/11-shared-cellar.md)。既存棚への差し込みは [04-cellar.md](../screen-designs/04-cellar.md)。

| 画面 ID | パス | 概要 |
|---|---|---|
| bottle-list（改訂） | `/cellar` | ヘッダー下にセラー選択行。選択中セラーの棚 |
| bottle-archive（改訂） | `/cellar/archive` | 同じセラーの貯蔵庫。戻るで個人セラーへ飛ばない |
| bottle-new / bottle-batch（改訂） | `/cellar/new` `/cellar/batch` | 先頭に保存先。新規のみ変更可 |
| bottle-detail / bottle-edit（改訂） | `/cellar/:id` | 最終更新、共有メモ表記、競合比較、共有削除文 |
| cellar-share-new | `/cellar/share` | 共有開始 |
| cellar-share-created | `/cellar/share/created` | 招待（主）と移動（副） |
| cellar-share-settings | `/cellar/share/settings` | 名称・参加者・招待・移動・危険操作 |
| cellar-share-invite | `/cellar/share/invite` | リンク共有 / コピー |
| cellar-share-move | `/cellar/share/move` | 個人→共有の選択と確認 |
| cellar-share-activity | `/cellar/share/activity` | 最近の変更 |
| cellar-join | `/join` | 公開。未ログインは一般説明。トークンは `#t=` |

下部タブは増やさない。選択行タップでボトムシート（ルートなし）。

---

## 7. API

契約の正本は [api-design.md](../api-design.md) 4.8。概要:

| 操作 | 契約 |
|---|---|
| 所属一覧 | `GET /api/cellars` |
| 共有作成 | `POST /api/cellars`（name + operationKey） |
| 設定 | `GET` / `PATCH` / `DELETE /api/cellars/:id`（名称・削除はオーナー） |
| revision | `GET /api/cellars/:id/revision` |
| 参加者 | `GET /api/cellars/:id/members`、`DELETE .../members/:userId`（除名）、`POST .../leave` |
| 招待 | `POST/GET/DELETE /api/cellars/:id/invitations`。確認・参加は `POST /api/cellar-invitations/preview\|accept`（トークンは本文） |
| 移譲 | `POST /api/cellars/:id/transfers`、`POST .../accept`、`POST .../cancel` |
| 履歴 | `GET /api/cellars/:id/activity` |
| ボトル | 既存ルートに `cellarId` / `expectedVersion` / `operationKey`。`scope=accessible` は新クライアントのピッカー。種類内の並びは `PUT /api/bottles/order` |
| 移動 | `POST /api/cellars/:id/moves` |

旧クライアント:

- `cellarId` 省略の一覧・作成は個人セラーのみ。共有ボトルは返さない
- 共有ボトルの更新で `expectedVersion` なしは 400
- 暗黙に共有へ保存しない

---

## 8. データと移行

1. 既存ユーザーごとに個人セラーを作り、既存ボトルを紐付ける。ID・状態・写真・個人記録の関連は変えない
2. ボトル写真はセラー所有へ移す。ノート / 飲酒記録 / 未紐付けは個人のまま
3. 個人セラーは `user_cellar_slots.personal_cellar_id` の一意で重複しない
4. 共有参加は `user_cellar_slots.shared_cellar_id` を `IS NULL` のときだけ埋める
5. `user` 削除の CASCADE を共有ボトル・共有写真へ伝えない。`cellars.owner_user_id` は RESTRICT
6. 共有データ作成後に旧 schema へ戻す down は書かない

---

## 9. 同期と競合

- 前景で共有セラー関連画面を開いている間、同一タブ 1 セラー 1 系統で 5 秒ごとに revision を確認
- 非表示・オフラインは停止。復帰・セラー変更時は即時。エラーはバックオフ
- revision 変化時は一覧・件数・対象詳細・参加者を再取得。個人記録・ノートは再取得しない
- 文言は「変更は数秒で反映されます」。毎回スピナーは出さない
- 失敗時は「最新の変更を確認できません。再試行」。前データを最新扱いしない
- 一覧先頭なら自動適用し「セラーを更新しました」（複数変更は 1 件）。スクロール中は位置を保ち、追加分は「新しいボトルが追加されました」
- 編集フォームは初期値の再設定で入力を捨てない
- 更新は `expectedVersion` 一致が条件。409 なら項目ごとの現在値 / 自分の入力を比較。無条件の強制上書きは置かない
- 同じ操作キーの再試行は結果を再利用。本文ハッシュ不一致は 409

---

## 10. 退会

| 状況 | 結果 |
|---|---|
| 通常メンバー | 参加解除。共有ボトル・写真は残す。登録者参照は匿名化（「退会したメンバー」） |
| オーナー（他メンバーあり） | 移譲完了または共有セラー削除が先。ユーザー削除まで進めて止めない |
| 最後の 1 人 | 個人データに加え残っている共有セラーも削除対象と明示 |
| 共有セラー削除 | オーナー。名称入力確認。全ボトル・写真が消え、各自の記録・ノートは残る |

退会者の表示名・メールを履歴へ固定保存し続けない。取得済み画像の回収は約束しない。

アカウント削除の写真回収は `photos.user_id`（個人写真）と削除対象セラーのボトル写真だけ。共有に残す写真を旧 userId で回収しない。

---

## 11. 個人記録との接続

- 飲酒記録・ノートの所有は本人のみ
- ピッカーは個人 / 共有の保存先を明示する
- 脱退後も本人の記録・ノートは表示できる。ボトル再取得不能を理由に記録全体を 404 にしない
- 参照権限を失ったらスナップショットだけ出し、共有写真への導線は隠す
- ボトル / セラー物理削除は記録・ノートの `bottle_id` を SET NULL

---

## 12. セキュリティ

| 観点 | 規則 |
|---|---|
| 招待トークン | 32 バイト以上の暗号学的乱数。DB は SHA-256 ハッシュのみ。認証トークンと兼用しない |
| 参加 | 認証済み POST のみ。GET やプレビューで消費しない。既存 CSRF / Origin 対策 |
| URL | 生トークンは `#t=`（フラグメント）。クエリやサーバーログに出さない |
| 未ログイン join | ボトル・写真・メンバー名を出さない |
| 写真 | `private, no-store` 維持。SW / Cache Storage / 永続 Query へ共有応答を新規保存しない |
| レート | 招待発行・確認/参加・共有作成。期限判定はサーバー時刻 |
| ログ | トークン・メール・Cookie を出さない |

---

## 13. 法務

規約・PP に共有範囲（在庫・写真・メモは参加者に見える。飲酒記録・ノートは共有しない）、招待リンク、脱退後の残存、未ログイン `/join` の非開示を書く。版は `2026-09-13`。[legal.md](../legal.md)。再同意ゲートは作らない（8-01 どおり）。

---

## 14. 展開順

1. migration（テーブル追加 → 個人セラー作成 → ボトル/写真の所有切替）
2. 新旧互換サーバー（省略時は個人セラー。共有は新フィールド必須）
3. 新 UI

ロールバックは機能非表示と前進修正。旧 schema への無条件復帰はしない。
