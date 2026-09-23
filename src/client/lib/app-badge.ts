/**
 * ホーム画面アイコンのバッジ（`spec/features/pwa.md` 6.2）。Badging API はここからだけ呼ぶ。
 * 非対応環境では何もしない。OS が拒否・未インストールで reject しても画面を止めない。
 * iOS は通知許可が無いと表示しないが、許可は求めない（段階 1）。
 */
export type BadgeNavigator = {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function browserNavigator(): BadgeNavigator | undefined {
  return typeof navigator === "undefined" ? undefined : navigator;
}

export function isAppBadgeSupported(nav: BadgeNavigator | undefined = browserNavigator()): boolean {
  return typeof nav?.setAppBadge === "function" || typeof nav?.clearAppBadge === "function";
}

export function badgeCount(count: number): number {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export async function syncAppBadge(
  count: number,
  nav: BadgeNavigator | undefined = browserNavigator(),
): Promise<void> {
  if (!nav) {
    return;
  }
  const n = badgeCount(count);
  try {
    if (n > 0) {
      if (typeof nav.setAppBadge === "function") {
        await nav.setAppBadge(n);
      }
      return;
    }
    if (typeof nav.clearAppBadge === "function") {
      await nav.clearAppBadge();
    } else if (typeof nav.setAppBadge === "function") {
      await nav.setAppBadge(0);
    }
  } catch {
    // 未インストール・権限なし・OS 非対応。バッジは補助表示なので黙って諦める
  }
}

export function clearAppBadge(nav: BadgeNavigator | undefined = browserNavigator()): Promise<void> {
  return syncAppBadge(0, nav);
}
