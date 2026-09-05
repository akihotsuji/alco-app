# 1-07 詳細画面設計（screen-designs）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 1 設計 |
| ステータス | **レビュー待ち**（成果物: [spec/screen-designs/](../../spec/screen-designs/README.md)。2026-09-05 オーナー指示で追加） |
| 要件 | 全画面の機能・要素・状態・遷移をイメージ図付きで確定し、「設計どおりに実装する」決まりを作る |
| ソース | オーナー指示（2026-09-05）: 画面設計とイメージ図を作り、実装はそのとおりに行う。記録タブを中央に。セラーは撮って陳列・追加と消費・消費で貯蔵庫へ移りその日の記録へ。記録・ノートは写真を撮って付ける。キャラクターでポップに |

## 1. 概要

1-01（ルート）と 1-02（骨格）を、**画面単位の要素表・状態・遷移・モック**まで落とす。Phase 2 以降の画面実装は本成果物のとおりに作り、受け入れチェックを PR に貼る。

## 2. 前提条件

- 1-01〜1-06 承認済み
- 1-08（キャラクター）と並行。モックにキャラクターを載せる
- data-model / api-design の改訂（消費・貯蔵庫・記録写真）を同じ PR で行う

## 3. スコープ

**対象**

- 共通シェル（タブ中央、ヘッダー、トースト、ダイアログ、空・エラー・ローディング）
- 認証 / ホーム・サマリー / 記録（日別・入力・編集・マイドリンク）/ セラー（棚・貯蔵庫・追加・詳細・消費・編集）/ ノート（グリッド・作成・詳細・編集）/ 設定 / 写真パイプライン
- 各画面のモック PNG（390×844 @2x、ライト。ホームと棚はダークも）
- 「設計どおりに実装する」ルールを rules / skill に転記

**対象外**

- 実装コード
- 背景除去（切り抜き）— v1.x として注記のみ
- 週 / 月サマリーのチャートライブラリ選定（3-06）

## 4. 成果物

- `spec/screen-designs/README.md`（ルール・索引・設計判断・要確認）
- `spec/screen-designs/00〜07-*.md`
- `spec/wireframes/mocks/*.png` の更新と `preview.html` の改修
- `spec/screens.md` / `design-system.md` / `data-model.md` / `api-design.md` / `01-requirements.md` / `02-tech-stack.md` / `03-roadmap.md` の同期
- `.cursor/rules/development-workflow.mdc` / `ui-design.mdc` / `.cursor/skills/feature-dev/SKILL.md` の追記

## 5. 細分化タスク

1. タブ順・中央タブの挙動を決める（着地は `/logs`。代替案は要確認に残す）
2. セラーの概念（追加 / 消費 / 貯蔵庫 / 1 行 = 1 本）を決め、data-model / api に落とす
3. 写真パイプライン（取り込み・比率・色補正・合成・アップロード時期・GC）を決める
4. 画面ごとに要素表・状態・遷移・受け入れチェックを書く
5. `preview.html` を改修し PNG を再生成する（キャラクターはインライン SVG）
6. ルール転記
7. オーナーレビュー → 修正 → 承認

## 6. 手順

ブランチ `feature/detailed-screen-design`。PR: `docs: 詳細画面設計・キャラクター・セラー陳列/消費を追加`。

モックの再生成（ローカル。リポジトリにスクリプトは置かない）:

```powershell
# Edge headless で preview.html?s=<id>&theme=dark を 390x844 @2x で撮る
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=390,844 --screenshot=spec\wireframes\mocks\home.png "file:///C:/alco-app/spec/wireframes/mocks/preview.html?s=home"
```

## 7. 仕様詳細

[spec/screen-designs/README.md](../../spec/screen-designs/README.md) の「1-07 で確定した設計判断」を正とする。要確認はオーナーが決める:

| 項目 | 既定 |
|---|---|
| 中央タブの着地 | 今日の日別 `/logs` |
| 本数 N の上限 | 12 |
| ノート写真枚数 | 6 |

## 8. 受け入れ条件

- [x] 全画面（`screens.md` の MVP 画面 + `photo-edit` + `bottle-consume`）に要素表・状態・遷移・受け入れチェックがある
- [x] モック PNG が設計と一致し、ライト／ダーク（ホーム・棚）がある
- [x] data-model / api-design に「1-07 改訂」節があり、画面の API 参照と一致する
- [x] rules / skill に「設計どおりに実装」が転記されている
- [ ] オーナー承認（タブ順・棚・消費・写真・キャラクター）

## 9. セキュリティ観点

- ダミーデータのみ（実名・実店舗なし）
- 写真は端末内加工・サーバー magic bytes 検証・未紐付け GC を設計に含めた
- 消費 / 復元 API は `id + user_id`、他人・不在・状態不一致は 404

## 10. 関連ファイル / 関連spec

- 正本: [spec/screen-designs/](../../spec/screen-designs/README.md)
- [08-character-mascot.md](08-character-mascot.md)
- [spec/screens.md](../../spec/screens.md)、[spec/design-system.md](../../spec/design-system.md)
- 実装: [../phase-02-platform/05-common-layout.md](../phase-02-platform/05-common-layout.md)、[../phase-02-platform/08-photo-pipeline.md](../phase-02-platform/08-photo-pipeline.md)、[../phase-04-cellar/00-phase.md](../phase-04-cellar/00-phase.md)

## 11. リスク・注意点

- 設計が細かいほど実装が「設計を直す PR」を挟むことになる。それを許容し、勝手に逸脱しないのが本タスクの狙い
- モック PNG は差分レビューしにくい。要素表を正とし、PNG は質感確認に留める
