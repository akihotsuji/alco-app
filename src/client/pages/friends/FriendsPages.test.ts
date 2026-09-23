import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "FriendsPages.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("FriendsPages 近況と入口", () => {
  it("一覧は横型カードで、プロフィール必須案内を出さない", () => {
    expect(source).toContain("PostCard");
    expect(source).toContain("eagerPhoto");
    expect(source).toContain("SOCIAL_COPY.pasteInvite");
    expect(source).toContain("友達を招待");
    expect(source).toContain('to="/friends/invite"');
    expect(source).toContain('to="/friends/join"');
    expect(source).not.toContain("profileRequired");
    expect(source).not.toContain("友達に表示する名前");
    expect(css).toContain(".social-feed-card");
    expect(css).toContain(".social-feed-thumb");
    expect(css).toContain(".social-card-photo");
  });
});

describe("FriendsPages 一覧の名前", () => {
  it("友達・申請・ブロックの名前に横書き用クラスを付ける", () => {
    expect(source).toContain("friends-row-name");
    expect(source.match(/friends-row-name/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain("{friend.nickname}");
    expect(source).toContain("{request.peer.nickname}");
    expect(source).toContain("{item.nickname}");
  });

  it("行内ボタンは幅いっぱい伸ばさず、名前は横書き1行にする", () => {
    expect(css).toContain(".friends-row > .app-btn");
    expect(css).toContain("writing-mode: horizontal-tb");
    expect(css).toContain(".friends-row-name");
    const nameBlock = css.slice(
      css.indexOf(".friends-row-name"),
      css.indexOf(".friends-header-actions"),
    );
    expect(nameBlock).toContain("white-space: nowrap");
    expect(nameBlock).toContain("text-overflow: ellipsis");
  });
});

describe("FriendsPostPage 共有詳細", () => {
  const detail = readFileSync(join(here, "../../components/friends/PostDetailItem.tsx"), "utf8");

  it("写真はボトル詳細と同じ主写真 + 脇の小サムネで、全幅の大きな写真を積まない", () => {
    expect(source).toContain("PostDetailItem");
    expect(source.slice(source.indexOf("export function FriendsPostPage"))).not.toContain(
      "social-card-photo",
    );
    expect(detail).toContain("bottle-detail-photos");
    expect(detail).toContain("bottle-hero-img is-photo");
    expect(detail).toContain("bottle-back-thumb");
    expect(detail).toContain("PhotoViewer");
    expect(css).toContain(".social-post-thumbs");
    expect(css).toContain("max-height: 240px");
  });

  it("複数アイテムは小さな写真の横並び。作者の操作は 1 行にまとめる", () => {
    expect(source).toContain("compact={post.items.length > 1}");
    expect(detail).toContain("social-post-item is-compact");
    expect(css).toContain(".social-post-item.is-compact");
    expect(source).toContain("social-post-actions");
    expect(css).toContain(".social-post-actions > .app-btn");
  });
});
