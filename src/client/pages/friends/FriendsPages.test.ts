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
