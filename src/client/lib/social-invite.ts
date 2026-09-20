import { isInviteToken } from "@/shared/social.ts";

export const FRIEND_JOIN_TOKEN_KEY = "friends.joinToken";
export const FRIEND_JOIN_URL_KEY = "friends.joinUrl";
export const FRIEND_JOIN_USER_KEY = "friends.joinUserId";
export const FRIEND_OWN_INVITE_TOKEN_KEY = "friends.ownInviteToken";
export const FRIEND_SUCCESS_TOAST_KEY = "friends.successToast";

export type ParsedInviteUrl =
  | { ok: true; token: string; url: string }
  | { ok: false; reason: "invalid" };

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // 記憶できなくても画面内の state で進める
  }
}

function storageRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // 破棄できなくても申請成功後は画面を離れる
  }
}

export function tokenFromInviteUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hash = parsed.hash.replace(/^#/, "");
    return new URLSearchParams(hash).get("t");
  } catch {
    return null;
  }
}

export function friendInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/friends/join#t=${token}`;
}

export function parsePastedInviteUrl(raw: string, origin: string): ParsedInviteUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid" };
  }
  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(trimmed);
    expected = new URL(origin);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && expected.protocol === "http:")
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.origin !== expected.origin) {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.pathname !== "/friends/join") {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.search) {
    return { ok: false, reason: "invalid" };
  }
  const hash = parsed.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const keys = [...params.keys()];
  if (keys.length !== 1 || keys[0] !== "t") {
    return { ok: false, reason: "invalid" };
  }
  const token = params.get("t") ?? "";
  if (!isInviteToken(token)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, token, url: friendInviteUrl(expected.origin, token) };
}

function persistReceivedInvite(token: string, origin: string, userId?: string | null) {
  storageSet(FRIEND_JOIN_TOKEN_KEY, token);
  storageSet(FRIEND_JOIN_URL_KEY, friendInviteUrl(origin, token));
  if (userId) {
    storageSet(FRIEND_JOIN_USER_KEY, userId);
  } else {
    storageRemove(FRIEND_JOIN_USER_KEY);
  }
}

export function captureFriendJoinToken(
  hash: string,
  replaceUrl?: (url: string) => void,
  options?: { origin?: string; userId?: string | null },
): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("t");
  const origin = options?.origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  if (token && isInviteToken(token)) {
    persistReceivedInvite(token, origin, options?.userId);
    if (replaceUrl && typeof window !== "undefined") {
      const next = new URL(window.location.href);
      next.hash = "";
      replaceUrl(`${next.pathname}${next.search}`);
    }
    return token;
  }
  return readStoredJoinToken(options?.userId);
}

export function readStoredJoinToken(currentUserId?: string | null): string | null {
  const storedUserId = storageGet(FRIEND_JOIN_USER_KEY);
  if (storedUserId && currentUserId && storedUserId !== currentUserId) {
    return null;
  }
  const token = storageGet(FRIEND_JOIN_TOKEN_KEY);
  return token && isInviteToken(token) ? token : null;
}

export function reconstructStoredInviteUrl(origin: string): string | null {
  const stored = storageGet(FRIEND_JOIN_URL_KEY);
  if (stored) {
    const parsed = parsePastedInviteUrl(stored, origin);
    if (parsed.ok) {
      return parsed.url;
    }
  }
  const token = storageGet(FRIEND_JOIN_TOKEN_KEY);
  if (token && isInviteToken(token)) {
    return friendInviteUrl(origin, token);
  }
  return null;
}

export function clearReceivedInvite() {
  storageRemove(FRIEND_JOIN_TOKEN_KEY);
  storageRemove(FRIEND_JOIN_URL_KEY);
  storageRemove(FRIEND_JOIN_USER_KEY);
}

export function bindReceivedInviteUser(userId: string) {
  const token = storageGet(FRIEND_JOIN_TOKEN_KEY);
  if (token && isInviteToken(token)) {
    storageSet(FRIEND_JOIN_USER_KEY, userId);
  }
}

export function clearFriendSessionArtifacts() {
  clearReceivedInvite();
  storageRemove(FRIEND_OWN_INVITE_TOKEN_KEY);
  storageRemove(FRIEND_SUCCESS_TOAST_KEY);
}

export function rememberOwnInviteToken(url: string) {
  const token = tokenFromInviteUrl(url);
  if (!token) {
    return;
  }
  storageSet(FRIEND_OWN_INVITE_TOKEN_KEY, token);
}

export function readOwnInviteToken(): string | null {
  return storageGet(FRIEND_OWN_INVITE_TOKEN_KEY);
}

export function rememberFriendSuccessToast(message: string) {
  storageSet(FRIEND_SUCCESS_TOAST_KEY, message);
}

export function consumeFriendSuccessToast(): string | null {
  const value = storageGet(FRIEND_SUCCESS_TOAST_KEY);
  if (value) {
    storageRemove(FRIEND_SUCCESS_TOAST_KEY);
  }
  return value;
}

export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function newSocialOperationKey(): string {
  return crypto.randomUUID();
}
