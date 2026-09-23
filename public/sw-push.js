/*
 * 酒のしおり Web Push の SW 部分（spec/features/web-push.md 6 章）。sw.js が importScripts で読む。
 * 文言は src/shared/web-push.ts の PUSH_COPY と同じ（src/client/lib/sw-push.test.ts が一致を固定）。
 * 名前・お酒・リアクションの種類・写真は出さない。ペイロードは種別と未読数だけ。
 */
(() => {
  const TITLE = "酒のしおり";
  const BODIES = {
    friend_request: "友達申請が届きました",
    friend_accepted: "友達申請が承認されました",
    reaction: "あなたの共有にリアクションがありました",
  };
  const FALLBACK_BODY = "友達から新しいお知らせがあります";
  const OPEN_PATH = "/friends/notifications";
  const TAG = "social";
  const ICON = "/pwa/pwa-192x192.png";
  const UNREAD_MAX = 9999;

  function readPayload(event) {
    if (!event.data) {
      return null;
    }
    let data;
    try {
      data = event.data.json();
    } catch {
      return null;
    }
    if (!data || typeof data !== "object" || data.v !== 1) {
      return null;
    }
    const type = Object.prototype.hasOwnProperty.call(BODIES, data.type) ? data.type : null;
    const unread =
      Number.isInteger(data.unread) && data.unread >= 0 && data.unread <= UNREAD_MAX
        ? data.unread
        : null;
    return { type, unread };
  }

  function updateBadge(unread) {
    const nav = self.navigator;
    if (unread === null || !nav) {
      return Promise.resolve();
    }
    try {
      if (unread > 0 && typeof nav.setAppBadge === "function") {
        return Promise.resolve(nav.setAppBadge(unread)).catch(() => undefined);
      }
      if (unread === 0 && typeof nav.clearAppBadge === "function") {
        return Promise.resolve(nav.clearAppBadge()).catch(() => undefined);
      }
    } catch {
      // バッジは補助表示。未対応・拒否でも通知は出す
    }
    return Promise.resolve();
  }

  self.addEventListener("push", (event) => {
    const payload = readPayload(event);
    const body = payload && payload.type ? BODIES[payload.type] : FALLBACK_BODY;
    // iOS は通知を出さないプッシュが続くと購読を取り消すため、必ず表示する
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(TITLE, {
          body,
          tag: TAG,
          renotify: true,
          icon: ICON,
          lang: "ja",
        }),
        updateBadge(payload ? payload.unread : null),
      ]),
    );
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const origin = self.location.origin;
    const target = new URL(OPEN_PATH, origin).href;
    event.waitUntil(
      (async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of windows) {
          if (new URL(client.url).origin !== origin) {
            continue;
          }
          try {
            const focused = typeof client.focus === "function" ? await client.focus() : client;
            const view = focused || client;
            if (typeof view.navigate === "function") {
              await view.navigate(target);
            }
            return;
          } catch {
            // 制御外のウィンドウは navigate できない。新しく開く
          }
        }
        if (self.clients.openWindow) {
          await self.clients.openWindow(target);
        }
      })(),
    );
  });
})();
