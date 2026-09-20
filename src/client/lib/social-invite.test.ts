import { afterEach, describe, expect, it } from "vitest";
import {
  captureFriendJoinToken,
  FRIEND_JOIN_TOKEN_KEY,
  rememberOwnInviteToken,
  tokenFromInviteUrl,
} from "./social-invite.ts";

const sessionStore = new Map<string, string>();

afterEach(() => {
  sessionStore.clear();
});

function stubSession() {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        sessionStore.set(key, value);
      },
      removeItem: (key: string) => {
        sessionStore.delete(key);
      },
    },
  });
}

describe("social-invite", () => {
  it("招待 URL の #t= からトークンを取る", () => {
    expect(tokenFromInviteUrl("http://localhost/friends/join#t=abc_DEF-123")).toBe("abc_DEF-123");
    expect(tokenFromInviteUrl("not-a-url")).toBeNull();
  });

  it("参加ハッシュを sessionStorage に残し、再訪時も読む", () => {
    stubSession();
    expect(captureFriendJoinToken("#t=join-token-1")).toBe("join-token-1");
    expect(sessionStore.get(FRIEND_JOIN_TOKEN_KEY)).toBe("join-token-1");
    expect(captureFriendJoinToken("")).toBe("join-token-1");
  });

  it("自分の招待 URL のトークンを覚える", () => {
    stubSession();
    rememberOwnInviteToken("http://localhost/friends/join#t=own-token");
    expect(sessionStore.get("friends.ownInviteToken")).toBe("own-token");
  });
});
