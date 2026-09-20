export const FRIEND_JOIN_TOKEN_KEY = "friends.joinToken";
export const FRIEND_OWN_INVITE_TOKEN_KEY = "friends.ownInviteToken";

export function tokenFromInviteUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hash = parsed.hash.replace(/^#/, "");
    return new URLSearchParams(hash).get("t");
  } catch {
    return null;
  }
}

export function captureFriendJoinToken(hash: string, replaceUrl?: (url: string) => void): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("t");
  if (token) {
    try {
      sessionStorage.setItem(FRIEND_JOIN_TOKEN_KEY, token);
    } catch {
      // 記憶できなくても画面内の state で進める
    }
    if (replaceUrl) {
      const next = new URL(window.location.href);
      next.hash = "";
      replaceUrl(`${next.pathname}${next.search}`);
    }
    return token;
  }
  try {
    return sessionStorage.getItem(FRIEND_JOIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function rememberOwnInviteToken(url: string) {
  const token = tokenFromInviteUrl(url);
  if (!token) {
    return;
  }
  try {
    sessionStorage.setItem(FRIEND_OWN_INVITE_TOKEN_KEY, token);
  } catch {
    // 再表示できなくても再発行できる
  }
}

export function readOwnInviteToken(): string | null {
  try {
    return sessionStorage.getItem(FRIEND_OWN_INVITE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function newSocialOperationKey(): string {
  return crypto.randomUUID();
}
