const STORAGE_PREFIX = "list-scroll:";

export function listScrollKey(pathname: string, search: string): string | null {
  if (pathname === "/cellar" || pathname === "/cellar/archive" || pathname === "/notes") {
    return `${STORAGE_PREFIX}${pathname}${search}`;
  }
  return null;
}

export function readListScroll(key: string | null): number | null {
  if (!key) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeListScroll(key: string | null, top: number): void {
  if (!key) {
    return;
  }
  try {
    sessionStorage.setItem(key, String(Math.max(0, Math.round(top))));
  } catch {
    // プライベートモード等
  }
}
