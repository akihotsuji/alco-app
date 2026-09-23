import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "./base64url.ts";
import { DRINK_TYPE_LABELS } from "./constants.ts";
import {
  isAllowedPushEndpoint,
  isPushAuthSecret,
  isPushP256dh,
  PUSH_COPY,
  PUSH_UI_COPY,
  pushNotificationContent,
  pushPayloadSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
} from "./web-push.ts";

const REACTION_LABELS = [
  "いいね",
  "おいしそう",
  "飲んでみたい",
  "びっくり",
  "おめでとう",
  "乾杯",
  "気になる",
];

function p256dh(): string {
  const bytes = new Uint8Array(65);
  bytes[0] = 0x04;
  bytes.fill(7, 1);
  return encodeBase64Url(bytes);
}

function authSecret(): string {
  return encodeBase64Url(new Uint8Array(16).fill(3));
}

describe("base64url", () => {
  it("往復し、パディングと標準 base64 の記号を受けない", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    const text = encodeBase64Url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(decodeBase64Url(text)).toEqual(bytes);
    expect(decodeBase64Url("ab+c")).toBeNull();
    expect(decodeBase64Url("abc=")).toBeNull();
    expect(decodeBase64Url("a")).toBeNull();
  });
});

describe("ロック画面の文言", () => {
  it("種別ごとの汎用文。不明は共通文", () => {
    expect(pushNotificationContent("friend_request")).toEqual({
      title: "酒のしおり",
      body: "友達申請が届きました",
    });
    expect(pushNotificationContent("friend_accepted").body).toBe("友達申請が承認されました");
    expect(pushNotificationContent("reaction").body).toBe("あなたの共有にリアクションがありました");
    expect(pushNotificationContent("new_post").body).toBe("友達から新しいお知らせがあります");
    expect(pushNotificationContent(null).body).toBe("友達から新しいお知らせがあります");
  });

  it("名前・お酒・リアクションの種類・飲酒を促す言葉を含まない", () => {
    const bodies = [...Object.values(PUSH_COPY.bodies), PUSH_COPY.fallbackBody];
    const all = [PUSH_COPY.title, ...bodies];
    for (const text of all) {
      expect(text).not.toMatch(/さん|様|『|』|「|」/);
      for (const label of REACTION_LABELS) {
        expect(text).not.toContain(label);
      }
      for (const label of Object.values(DRINK_TYPE_LABELS)) {
        expect(text).not.toContain(label);
      }
      expect(text).not.toMatch(/もう一杯|飲もう|飲みに|一杯/);
    }
    for (const body of bodies) {
      expect(body).not.toMatch(/酒|飲|杯/);
    }
  });

  it("設定と案内の文言も名前やお酒を出さないと明記する", () => {
    expect(PUSH_UI_COPY.settingsCaption).toContain("名前やお酒の内容は通知に出しません");
    expect(PUSH_UI_COPY.promptBody).toContain("名前やお酒の内容は通知に出しません");
    expect(PUSH_UI_COPY.denied).toContain("端末の設定");
  });
});

describe("ペイロード", () => {
  it("種別と未読数だけを受ける", () => {
    expect(pushPayloadSchema.safeParse({ v: 1, type: "reaction", unread: 3 }).success).toBe(true);
    expect(
      pushPayloadSchema.safeParse({ v: 1, type: "reaction", unread: 3, name: "A" }).success,
    ).toBe(false);
    expect(pushPayloadSchema.safeParse({ v: 1, type: "new_post", unread: 3 }).success).toBe(false);
    expect(pushPayloadSchema.safeParse({ v: 1, type: "reaction", unread: -1 }).success).toBe(false);
    expect(pushPayloadSchema.safeParse({ v: 2, type: "reaction", unread: 1 }).success).toBe(false);
  });
});

describe("エンドポイントの許可リスト", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:APA91b",
    "https://fcm.googleapis.com/wp/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGuQyavXutnMH",
    "https://api.push.apple.com/3/device/x",
  ])("受ける: %s", (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://user:pass@fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.example/fcm/send/abc",
    "https://evilfcm.googleapis.com/fcm/send/abc",
    "https://push.apple.com/x",
    "https://evil.example/.push.apple.com",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
    "https://127.0.0.1/push",
    "https://localhost/push",
    "https://fcm.googleapis.com/fcm/send/abc#frag",
    "javascript:alert(1)",
    "not a url",
    `https://fcm.googleapis.com/${"a".repeat(2100)}`,
  ])("受けない: %s", (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

describe("購読ボディ", () => {
  it("PushSubscription.toJSON() と同じ形を受ける", () => {
    const parsed = pushSubscriptionBodySchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      expirationTime: null,
      keys: { p256dh: p256dh(), auth: authSecret() },
    });
    expect(parsed.success).toBe(true);
  });

  it("鍵の長さ・形式と未知キーを拒否する", () => {
    expect(isPushP256dh(p256dh())).toBe(true);
    expect(isPushP256dh(encodeBase64Url(new Uint8Array(65)))).toBe(false);
    expect(isPushP256dh(encodeBase64Url(new Uint8Array(33).fill(4)))).toBe(false);
    expect(isPushAuthSecret(authSecret())).toBe(true);
    expect(isPushAuthSecret(encodeBase64Url(new Uint8Array(15)))).toBe(false);
    const base = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: p256dh(), auth: authSecret() },
    };
    expect(pushSubscriptionBodySchema.safeParse({ ...base, userId: "x" }).success).toBe(false);
    expect(
      pushSubscriptionBodySchema.safeParse({ ...base, keys: { ...base.keys, extra: "1" } }).success,
    ).toBe(false);
    expect(
      pushSubscriptionBodySchema.safeParse({ ...base, endpoint: "https://evil.example/p" }).success,
    ).toBe(false);
    expect(pushUnsubscribeBodySchema.safeParse({ endpoint: base.endpoint }).success).toBe(true);
    expect(
      pushUnsubscribeBodySchema.safeParse({ endpoint: base.endpoint, userId: "x" }).success,
    ).toBe(false);
  });
});
