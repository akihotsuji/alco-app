import { z } from "zod";
import { decodeBase64Url } from "./base64url.ts";
import { PWA_NAME } from "./pwa.ts";
import { SOCIAL_NOTIFICATION_TYPES, type SocialNotificationType } from "./social.ts";

/**
 * Web Push（段階 2）の契約。正本は spec/features/web-push.md。
 * ロック画面の文言は `public/sw-push.js` と同じ文字列を持つ（`sw-push.test.ts` が一致を固定）。
 */

export const PUSH_NOTIFICATION_TYPES = SOCIAL_NOTIFICATION_TYPES;
export type PushNotificationType = SocialNotificationType;

/** 名前・お酒・リアクションの種類・写真を入れない。飲酒を促す言葉を使わない。 */
export const PUSH_COPY = {
  title: PWA_NAME,
  bodies: {
    friend_request: "友達申請が届きました",
    friend_accepted: "友達申請が承認されました",
    reaction: "あなたの共有にリアクションがありました",
  },
  fallbackBody: "友達から新しいお知らせがあります",
} as const satisfies {
  title: string;
  bodies: Record<PushNotificationType, string>;
  fallbackBody: string;
};

export const PUSH_OPEN_PATH = "/friends/notifications";
export const PUSH_NOTIFICATION_TAG = "social";
export const PUSH_NOTIFICATION_ICON = "/pwa/pwa-192x192.png";
/** 配信サービス側で未送達を 1 件に畳む（RFC 8030 5.4。base64url 32 文字以内） */
export const PUSH_TOPIC = "social";
export const PUSH_TTL_SECONDS = 86_400;
export const PUSH_PAYLOAD_VERSION = 1;
export const PUSH_UNREAD_MAX = 9_999;

export const PUSH_MAX_SUBSCRIPTIONS_PER_USER = 10;
export const PUSH_SUBSCRIBE_RATE_MAX = 20;
export const PUSH_SUBSCRIBE_RATE_WINDOW_MS = 60 * 60 * 1000;
export const PUSH_ENDPOINT_MAX_LENGTH = 2048;
/** P-256 の非圧縮点（0x04 + X 32 + Y 32） */
export const PUSH_P256DH_BYTES = 65;
export const PUSH_AUTH_BYTES = 16;

/** `localStorage`。通知画面 N1 の案内を一度出したら（閉じた・許可・拒否）書く */
export const PUSH_PROMPT_DISMISSED_KEY = "push.prompt.dismissed";

export const PUSH_UI_COPY = {
  settingsLabel: "友達のお知らせを通知する",
  settingsCaption:
    "友達申請・承認・リアクションを、この端末に通知します。名前やお酒の内容は通知に出しません",
  iosNeedsInstall: "iPhone・iPad では、ホーム画面に追加した酒のしおりで使えます",
  unsupported: "この端末では使えません",
  unavailable: "現在は使えません",
  denied:
    "通知がブロックされています。端末の設定で酒のしおりの通知を許可してください（iPhone: 設定 → 通知 → 酒のしおり ／ Android: 設定 → アプリ → 酒のしおり または Chrome → 通知）",
  failed: "通知を設定できませんでした。時間をおいてもう一度試してください",
  promptTitle: "この端末にも通知を届けますか",
  promptBody:
    "友達申請・承認・リアクションがあったとき、アプリを閉じていてもお知らせします。名前やお酒の内容は通知に出しません。",
  promptAccept: "通知を受け取る",
  promptLater: "今はしない",
  promptDenied:
    "通知はオフのままです。あとから端末の設定で許可し、設定の「友達のお知らせを通知する」でオンにできます",
  promptClose: "閉じる",
  enabledToast: "通知をオンにしました",
} as const;

export function pushNotificationContent(type: string | null | undefined): {
  title: string;
  body: string;
} {
  const parsed = z.enum(PUSH_NOTIFICATION_TYPES).safeParse(type);
  return {
    title: PUSH_COPY.title,
    body: parsed.success ? PUSH_COPY.bodies[parsed.data] : PUSH_COPY.fallbackBody,
  };
}

export const pushPayloadSchema = z
  .object({
    v: z.literal(PUSH_PAYLOAD_VERSION),
    type: z.enum(PUSH_NOTIFICATION_TYPES),
    unread: z.number().int().min(0).max(PUSH_UNREAD_MAX),
  })
  .strict();
export type PushPayload = z.infer<typeof pushPayloadSchema>;

/**
 * 配信サービスの許可リスト（spec/features/web-push.md 2 章）。
 * 任意ホストを受けるとサーバーから任意 URL へ POST させられる（SSRF）。
 */
export const PUSH_ALLOWED_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
] as const;
export const PUSH_ALLOWED_HOST_SUFFIXES = [".push.apple.com"] as const;

export function isAllowedPushEndpoint(value: string): boolean {
  if (value.length > PUSH_ENDPOINT_MAX_LENGTH) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return (
    (PUSH_ALLOWED_HOSTS as readonly string[]).includes(host) ||
    PUSH_ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host.endsWith(suffix) && host.length > suffix.length,
    )
  );
}

export function isPushP256dh(value: string): boolean {
  const bytes = decodeBase64Url(value);
  return bytes?.length === PUSH_P256DH_BYTES && bytes[0] === 0x04;
}

export function isPushAuthSecret(value: string): boolean {
  return decodeBase64Url(value)?.length === PUSH_AUTH_BYTES;
}

const INVALID_ENDPOINT = "通知の送り先が正しくありません";
const INVALID_KEY = "通知の鍵が正しくありません";

export const pushEndpointSchema = z
  .string()
  .max(PUSH_ENDPOINT_MAX_LENGTH)
  .refine(isAllowedPushEndpoint, { message: INVALID_ENDPOINT });

export const pushSubscriptionBodySchema = z
  .object({
    endpoint: pushEndpointSchema,
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().max(128).refine(isPushP256dh, { message: INVALID_KEY }),
        auth: z.string().max(64).refine(isPushAuthSecret, { message: INVALID_KEY }),
      })
      .strict(),
  })
  .strict();
export type PushSubscriptionBody = z.infer<typeof pushSubscriptionBodySchema>;

export const pushUnsubscribeBodySchema = z.object({ endpoint: pushEndpointSchema }).strict();
export type PushUnsubscribeBody = z.infer<typeof pushUnsubscribeBodySchema>;

export type PushConfig = { available: boolean; publicKey: string | null };
