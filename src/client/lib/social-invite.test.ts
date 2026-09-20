import { afterEach, describe, expect, it } from "vitest";
import {
  bindReceivedInviteUser,
  captureFriendJoinToken,
  clearFriendSessionArtifacts,
  clearReceivedInvite,
  FRIEND_JOIN_TOKEN_KEY,
  FRIEND_JOIN_USER_KEY,
  FRIEND_OWN_INVITE_TOKEN_KEY,
  FRIEND_SUCCESS_TOAST_KEY,
  parsePastedInviteUrl,
  readStoredJoinToken,
  reconstructStoredInviteUrl,
  rememberFriendSuccessToast,
  rememberOwnInviteToken,
  tokenFromInviteUrl,
} from "./social-invite.ts";

const sessionStore = new Map<string, string>();
const TOKEN_A = `a${"x".repeat(31)}`;
const TOKEN_B = `b${"y".repeat(31)}`;

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
    expect(tokenFromInviteUrl(`http://localhost/friends/join#t=${TOKEN_A}`)).toBe(TOKEN_A);
    expect(tokenFromInviteUrl("not-a-url")).toBeNull();
  });

  it("参加ハッシュを sessionStorage に残し、再訪時も読む", () => {
    stubSession();
    expect(captureFriendJoinToken(`#t=${TOKEN_A}`, undefined, { origin: "http://localhost" })).toBe(
      TOKEN_A,
    );
    expect(sessionStore.get(FRIEND_JOIN_TOKEN_KEY)).toBe(TOKEN_A);
    expect(captureFriendJoinToken("", undefined, { origin: "http://localhost" })).toBe(TOKEN_A);
    expect(reconstructStoredInviteUrl("http://localhost")).toBe(
      `http://localhost/friends/join#t=${TOKEN_A}`,
    );
  });

  it("新しい招待 URL が古い保存より優先される", () => {
    stubSession();
    captureFriendJoinToken(`#t=${TOKEN_A}`, undefined, { origin: "http://localhost" });
    expect(captureFriendJoinToken(`#t=${TOKEN_B}`, undefined, { origin: "http://localhost" })).toBe(
      TOKEN_B,
    );
    expect(sessionStore.get(FRIEND_JOIN_TOKEN_KEY)).toBe(TOKEN_B);
  });

  it("別ユーザーの保存トークンは使わない", () => {
    stubSession();
    captureFriendJoinToken(`#t=${TOKEN_A}`, undefined, {
      origin: "http://localhost",
      userId: "user-a",
    });
    expect(sessionStore.get(FRIEND_JOIN_USER_KEY)).toBe("user-a");
    expect(readStoredJoinToken("user-b")).toBeNull();
    expect(readStoredJoinToken("user-a")).toBe(TOKEN_A);
  });

  it("申請成功後は受信トークンを消す", () => {
    stubSession();
    captureFriendJoinToken(`#t=${TOKEN_A}`, undefined, { origin: "http://localhost" });
    clearReceivedInvite();
    expect(readStoredJoinToken()).toBeNull();
    expect(reconstructStoredInviteUrl("http://localhost")).toBeNull();
  });

  it("ログイン後に受信トークンを現在のユーザーへ結びつける", () => {
    stubSession();
    captureFriendJoinToken(`#t=${TOKEN_A}`, undefined, { origin: "http://localhost" });
    bindReceivedInviteUser("user-a");
    expect(sessionStore.get(FRIEND_JOIN_USER_KEY)).toBe("user-a");
    expect(readStoredJoinToken("user-a")).toBe(TOKEN_A);
    expect(readStoredJoinToken("user-b")).toBeNull();
  });

  it("ログアウト時は受信招待と完了トーストを捨てる", () => {
    stubSession();
    captureFriendJoinToken(`#t=${TOKEN_A}`, undefined, { origin: "http://localhost" });
    rememberOwnInviteToken(`http://localhost/friends/join#t=${TOKEN_A}`);
    rememberFriendSuccessToast("友達申請を送りました");
    clearFriendSessionArtifacts();
    expect(readStoredJoinToken()).toBeNull();
    expect(sessionStore.get(FRIEND_OWN_INVITE_TOKEN_KEY)).toBeUndefined();
    expect(sessionStore.get(FRIEND_SUCCESS_TOAST_KEY)).toBeUndefined();
  });

  it("自分の招待 URL のトークンを覚える", () => {
    stubSession();
    rememberOwnInviteToken(`http://localhost/friends/join#t=${TOKEN_A}`);
    expect(sessionStore.get("friends.ownInviteToken")).toBe(TOKEN_A);
  });

  it("貼り付け URL を同一オリジンと形式で検証する", () => {
    const origin = "https://app.example";
    expect(parsePastedInviteUrl(`${origin}/friends/join#t=${TOKEN_A}`, origin)).toEqual({
      ok: true,
      token: TOKEN_A,
      url: `${origin}/friends/join#t=${TOKEN_A}`,
    });
    expect(parsePastedInviteUrl("javascript:alert(1)", origin).ok).toBe(false);
    expect(parsePastedInviteUrl(`https://evil.example/friends/join#t=${TOKEN_A}`, origin).ok).toBe(
      false,
    );
    expect(parsePastedInviteUrl(`${origin}/friends/invite#t=${TOKEN_A}`, origin).ok).toBe(false);
    expect(parsePastedInviteUrl(`${origin}/friends/join?x=1#t=${TOKEN_A}`, origin).ok).toBe(false);
    expect(parsePastedInviteUrl(`${origin}/friends/join`, origin).ok).toBe(false);
    expect(parsePastedInviteUrl(`http://app.example/friends/join#t=${TOKEN_A}`, origin).ok).toBe(
      false,
    );
    expect(
      parsePastedInviteUrl(
        `http://127.0.0.1:5173/friends/join#t=${TOKEN_A}`,
        "http://127.0.0.1:5173",
      ).ok,
    ).toBe(true);
  });
});
