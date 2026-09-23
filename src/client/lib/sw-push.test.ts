import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  PUSH_COPY,
  PUSH_NOTIFICATION_ICON,
  PUSH_NOTIFICATION_TAG,
  PUSH_OPEN_PATH,
  PUSH_UNREAD_MAX,
  pushNotificationContent,
} from "@/shared/web-push.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = readFileSync(join(root, "public/sw-push.js"), "utf8");
const ORIGIN = "https://sake-shiori.com";

type Listener = (event: unknown) => void;

type FakeClient = {
  url: string;
  focus?: ReturnType<typeof vi.fn>;
  navigate?: ReturnType<typeof vi.fn>;
};

/** SW のグローバル（self）を最小限に偽装して public/sw-push.js をそのまま実行する */
function loadWorker(options: { badge?: boolean; clients?: FakeClient[] } = {}) {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn(async () => undefined);
  const setAppBadge = vi.fn(async () => undefined);
  const clearAppBadge = vi.fn(async () => undefined);
  const openWindow = vi.fn(async () => undefined);
  const matchAll = vi.fn(async () => options.clients ?? []);
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    registration: { showNotification },
    navigator: options.badge === false ? {} : { setAppBadge, clearAppBadge },
    clients: { matchAll, openWindow },
    location: { origin: ORIGIN },
  };
  runInNewContext(source, { self, URL });

  async function push(data: unknown) {
    const pending: Promise<unknown>[] = [];
    listeners.get("push")?.({
      data:
        data === undefined
          ? null
          : {
              json: () => {
                if (typeof data === "string") {
                  return JSON.parse(data);
                }
                return data;
              },
            },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  }

  async function click() {
    const pending: Promise<unknown>[] = [];
    const close = vi.fn();
    listeners.get("notificationclick")?.({
      notification: { close },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
    return close;
  }

  return { listeners, showNotification, setAppBadge, clearAppBadge, openWindow, push, click };
}

describe("public/sw-push.js", () => {
  it("push と notificationclick だけを登録し、fetch には触れない（/api/* NetworkOnly を変えない）", () => {
    const worker = loadWorker();
    expect([...worker.listeners.keys()].sort()).toEqual(["notificationclick", "push"]);
    expect(source).not.toMatch(/fetch\(|caches\.|importScripts\(|addEventListener\("fetch"/);
  });

  it.each(["friend_request", "friend_accepted", "reaction"] as const)(
    "%s は shared と同じ汎用文で通知し、バッジを未読数にする",
    async (type) => {
      const worker = loadWorker();
      await worker.push({ v: 1, type, unread: 3 });
      expect(worker.showNotification).toHaveBeenCalledWith(PUSH_COPY.title, {
        body: pushNotificationContent(type).body,
        tag: PUSH_NOTIFICATION_TAG,
        renotify: true,
        icon: PUSH_NOTIFICATION_ICON,
        lang: "ja",
      });
      expect(worker.setAppBadge).toHaveBeenCalledWith(3);
    },
  );

  it("未読 0 はバッジを消す", async () => {
    const worker = loadWorker();
    await worker.push({ v: 1, type: "reaction", unread: 0 });
    expect(worker.clearAppBadge).toHaveBeenCalledTimes(1);
    expect(worker.setAppBadge).not.toHaveBeenCalled();
  });

  it.each([
    ["空", undefined],
    ["JSON でない", "not json"],
    ["版違い", { v: 2, type: "reaction", unread: 1 }],
    ["未読が不正", { v: 1, type: "reaction", unread: PUSH_UNREAD_MAX + 1 }],
  ])("%s のペイロードでも共通文で必ず通知し、バッジは変えない", async (_label, data) => {
    const worker = loadWorker();
    await worker.push(data);
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = worker.showNotification.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(title).toBe(PUSH_COPY.title);
    if (data && typeof data === "object" && "unread" in data && data.v === 1) {
      expect(options.body).toBe(PUSH_COPY.bodies.reaction);
    } else {
      expect(options.body).toBe(PUSH_COPY.fallbackBody);
    }
    expect(worker.setAppBadge).not.toHaveBeenCalled();
    expect(worker.clearAppBadge).not.toHaveBeenCalled();
  });

  it("未知の種別は共通文。名前などの余計なキーは表示に使わない", async () => {
    const worker = loadWorker();
    await worker.push({ v: 1, type: "new_post", unread: 2, name: "Aさん", drink: "ワイン" });
    const [, options] = worker.showNotification.mock.calls[0] as unknown as [string, unknown];
    expect(options).toMatchObject({ body: PUSH_COPY.fallbackBody });
    expect(JSON.stringify(options)).not.toMatch(/Aさん|ワイン/);
    expect(worker.setAppBadge).toHaveBeenCalledWith(2);
  });

  it("バッジ API が無くても通知は出す", async () => {
    const worker = loadWorker({ badge: false });
    await worker.push({ v: 1, type: "reaction", unread: 1 });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
  });

  it("タップで既存ウィンドウを前面にし、通知一覧へ移る", async () => {
    const navigate = vi.fn(async () => undefined);
    const client: FakeClient = { url: `${ORIGIN}/`, navigate };
    client.focus = vi.fn(async () => client);
    const worker = loadWorker({ clients: [{ url: "https://other.example/" }, client] });
    const close = await worker.click();
    expect(close).toHaveBeenCalledTimes(1);
    expect(client.focus).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(`${ORIGIN}${PUSH_OPEN_PATH}`);
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("ウィンドウが無い・移れないときは通知一覧を新しく開く", async () => {
    const worker = loadWorker({ clients: [] });
    await worker.click();
    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}${PUSH_OPEN_PATH}`);

    const broken: FakeClient = {
      url: `${ORIGIN}/`,
      focus: vi.fn(async () => {
        throw new Error("not controlled");
      }),
    };
    const second = loadWorker({ clients: [broken] });
    await second.click();
    expect(second.openWindow).toHaveBeenCalledWith(`${ORIGIN}${PUSH_OPEN_PATH}`);
  });
});
