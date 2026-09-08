const STORAGE_PREFIX = "opened.followup.";

export type OpenedFollowupState = "pending" | "dismissed";

function storageKey(bottleId: string): string {
  return `${STORAGE_PREFIX}${bottleId}`;
}

export function markOpenedFollowupPending(bottleId: string): void {
  try {
    sessionStorage.setItem(storageKey(bottleId), "pending");
  } catch {
    // 記憶できなくても開栓自体は完了している
  }
}

export function markOpenedFollowupDismissed(bottleId: string): void {
  try {
    sessionStorage.setItem(storageKey(bottleId), "dismissed");
  } catch {
    // 再表示を防げなくても開栓は戻さない
  }
}

export function openedFollowupState(bottleId: string): OpenedFollowupState | null {
  try {
    const raw = sessionStorage.getItem(storageKey(bottleId));
    if (raw === "pending" || raw === "dismissed") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function shouldShowOpenedFollowup(bottleId: string): boolean {
  return openedFollowupState(bottleId) === "pending";
}

export function clearOpenedFollowup(bottleId: string): void {
  try {
    sessionStorage.removeItem(storageKey(bottleId));
  } catch {
    // 表示制御だけ。開栓状態は触らない
  }
}

export const FORM_ORIGINS = ["opened", "detail"] as const;

export type FormOrigin = (typeof FORM_ORIGINS)[number];

export function parseFormOrigin(raw: string | null): FormOrigin | null {
  if (raw === "opened" || raw === "detail") {
    return raw;
  }
  return null;
}

export function isBottleStartedForm(origin: FormOrigin | null, bottleId: string | null): boolean {
  return Boolean(origin && bottleId);
}
