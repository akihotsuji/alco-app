# 1-04 ER図とDrizzleスキーマ設計

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 1 設計 |
| ステータス | **完了**（`spec/data-model.md` 承認済み） |
| 要件 | 全データ user_id スコープ、テーブル候補はロードマップ記載 |
| ソース | Phase 1「users / drink_logs / my_drinks / bottles / tasting_notes / photos」 |

## 1. 概要

永続化の形を確定し、Phase 2-01 の Drizzle 実装の正本にする。Better Auth のユーザテーブルとアプリの `users` の関係をここで決める。

## 2. 前提条件

- [spec/01-requirements.md](../../spec/01-requirements.md) のフィールド一覧
- 1-06 の計算結果を **保存するか都度計算するか** をこのタスクか 1-06 で決める

## 3. スコープ

**対象**

- ER 図（Mermaid で `spec/data-model.md` 内に描くので十分）
- 各テーブルの列、型、NULL、ユニーク、外部キー
- インデックス（user_id + 日時 など）
- 削除方針（物理削除 vs 論理削除）

**対象外**

- マイグレーション SQL の実装（Phase 2-01）
- Better Auth の内部テーブル名の凍結（ライブラリ版に従い、data-model に「Auth ライブラリ管理」と書く）

## 4. 成果物

- `spec/data-model.md`（Phase 1 DoD）
- rule `database`（`.cursor/rules/database.mdc`、globs: `src/db/**`）

## 5. 細分化タスク

1. Better Auth の D1/Drizzle スキーマとアプリテーブルの境界を調査する
2. 6 エンティティの列を要件から落とす
3. 写真のポリモーフィック（bottles と notes）をどう持つか決める
4. ID 採番（UUID / ULID / nanoid）を決める
5. Mermaid ER と列定義表を書く
6. オーナー承認

## 6. 手順

1. Better Auth 公式の Drizzle adapter ドキュメントを読む（テーブルを自前で `users` と二重にしない）。
2. `spec/data-model.md` を作成する。構成:

- 原則（user_id 必須、カスケード）
- ER 図
- テーブル定義
- インデックス
- マイグレーション方針（Phase 2 の rule へ委譲する項目）

3. `database` ルール: スキーマ変更は drizzle-kit、命名は snake_case の DB 列 + camelCase の TS。
4. PR: `docs: データモデルを追加`

## 7. 仕様詳細

### 原則

- アプリ所有テーブルはすべて `user_id` を持ち、FK は Auth の user を参照
- 他ユーザー行を JOIN で混ぜない

### 草案（要確認は `spec/data-model.md` の「決定事項」で確定）

**drink_logs**

| 列 | 型案 | 備考 |
|---|---|---|
| id | text PK | |
| user_id | text not null | |
| drunk_at | integer (unix ms) or text ISO | **要確認** |
| drink_type | text enum | ワイン等 7 種 |
| volume_ml | integer | > 0 |
| abv_percent | real | 0〜100 |
| alcohol_g | real | **要確認: 保存するか生成列かアプリ計算か** |
| memo | text null | 長さ上限 **要確認**（例 500） |
| my_drink_id | text null | 記録時点のスナップショットを優先し、参照は任意 |
| created_at / updated_at | | |

種類変更後も記録は当時の量・度数を保持する（プリセット変更で過去が変わらない）。

**my_drinks**

- name, drink_type, volume_ml, abv_percent, sort_order, user_id

**bottles**

- name, category/type, producer, origin, vintage, purchased_at, price, shop, quantity, storage, memo, status enum, user_id
- 写真は photos へ 1:N か bottle.photo_id 1:1。一覧サムネは 1 枚。**要確認**

**tasting_notes**

- bottle_id null（都度入力の銘柄名 drink_name）
- tasted_at
- appearance, aroma, taste, finish（text）
- rating: 整数 10 倍（25 = 2.5）または real。**要確認**
- user_id

**photos**

- user_id, r2_key（サーバー生成）, content_type, byte_size, width/height 任意
- owner: `bottle_id` xor `tasting_note_id`（チェック制約）。SQLite なのでアプリ制約でも可。**要確認**

### ID

Workers で `crypto.randomUUID()` が使える。**推奨 UUID v4。要確認**。

### 削除

- 記録・ノート・ボトルは物理削除でよい（個人アプリ）。**要確認**
- ボトル削除時のノート: 阻止 / カスケード / bottle_id null。**要確認**（要件はボトル詳細からノート参照）

### タイムゾーン（2026-08-13 確定）

表示・日次集計・休肝日の日付境界は **Asia/Tokyo**。保存は UTC。

## 8. 受け入れ条件

- [x] `spec/data-model.md` 承認済み
- [x] 全アプリテーブルに user_id（Auth はライブラリ管理と明記）
- [x] enum 値が要件の種類・ステータスと一致
- [x] 写真の所有者が user_id で辿れる
- [x] database ルール（`.cursor/rules/database.mdc`）を同梱

## 9. セキュリティ観点

- user_id をクライアントから insert させない（セッションで付与）
- R2 キーにユーザーファイル名を使わない列設計
- 他ユーザーの id を知っても引けない（API 側。モデルは複合ユニーク user_id+id を検討）

## 10. 関連ファイル / 関連spec

- [spec/01-requirements.md](../../spec/01-requirements.md)
- [05-api-design.md](05-api-design.md)
- [06-alcohol-calc-presets.md](06-alcohol-calc-presets.md)
- 実装: [../phase-02-platform/01-drizzle-migration.md](../phase-02-platform/01-drizzle-migration.md)

## 11. リスク・注意点

- Auth の user テーブルをアプリが直接書き換えない
- SQLite に CHECK を書きすぎると Drizzle マイグレーションが煩雑。Zod を正でもよいが、DB にも enum 相当を書くと防御が厚い
- `quantity`（本数）とステータス「飲み切り」の二重管理
