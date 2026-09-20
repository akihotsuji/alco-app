import { z } from "zod";
import { operationKeySchema } from "./cellars.ts";
import { PHOTO_CONTENT_TYPES } from "./constants.ts";

export const SOCIAL_NICKNAME_MIN = 1;
export const SOCIAL_NICKNAME_MAX = 30;
export const SOCIAL_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const SOCIAL_AVATAR_EDGE = 512;
export const SOCIAL_FEED_LIMIT = 20;
export const SOCIAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SOCIAL_REACTION_CACHE_MS = 60_000;
export const DEFAULT_MASCOT_COLOR = "#8E2F3C";
export const MASCOT_COLOR_PRESETS = ["#8E2F3C", "#C45C6A", "#E8D5A3"] as const;
export const SOCIAL_CONTENT_CACHE_CONTROL = "private, no-store";

export const AVATAR_MODES = ["mascot", "uploaded"] as const;
export type AvatarMode = (typeof AVATAR_MODES)[number];

export const SOCIAL_POST_KINDS = [
  "drink_log",
  "cellar_add",
  "opening",
  "opening_with_log",
  "cellar_batch",
] as const;
export type SocialPostKind = (typeof SOCIAL_POST_KINDS)[number];

export const SOCIAL_SOURCE_KINDS = [
  "drink_log",
  "bottle",
  "opening_event",
  "tasting_note",
] as const;
export type SocialSourceKind = (typeof SOCIAL_SOURCE_KINDS)[number];

export const FRIEND_REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const;
export type FriendRequestStatus = (typeof FRIEND_REQUEST_STATUSES)[number];

export const SOCIAL_NOTIFICATION_TYPES = ["friend_request", "friend_accepted", "reaction"] as const;
export type SocialNotificationType = (typeof SOCIAL_NOTIFICATION_TYPES)[number];

export const SOCIAL_SHARE_SOURCE_KINDS = [
  "drink_log",
  "opening",
  "opening_with_log",
  "cellar_add",
  "cellar_batch",
] as const;

export const SOCIAL_MESSAGES = {
  nickname: `1文字以上${SOCIAL_NICKNAME_MAX}文字以内で入力してください`,
  nicknameControl: "使えない文字が含まれています",
  mascotColor: "色は #RRGGBB で指定してください",
  profileRequired: "友達に表示する名前を先に設定してください",
  noFriends: "共有できる友達がいません",
  invite: "招待リンクが正しくありません",
  cursor: "ページ情報が正しくありません",
  limit: "件数は1以上50以下で指定してください",
  reaction: "リアクションの指定が正しくありません",
  share: "共有の指定が正しくありません",
  avatar: "画像ファイルを指定してください",
} as const;

export const SOCIAL_COPY = {
  shareTitle: "酒のしおりの友達に共有",
  shareHint: "このアプリで友達になった人だけが見られます",
  shareNoBackfill: "新しく友達になっても、過去の記録は自動では公開されません",
  shareSwitch: "友達に共有",
  saveOnly: "保存",
  saveAndShare: "保存して友達に共有",
  shareDefault: "記録時の『友達に共有』を最初からオンにする",
  profileName: "友達に表示する名前",
  feedTitle: "友達の近況",
  feedEmptyNoFriends: "友達を追加すると、共有されたお酒の記録がここに表示されます",
  feedEmptyNoPosts: "友達になった後に共有された記録が表示されます",
  inviteShareText: "酒のしおりで友達になる",
  shareFailedAfterSave: "記録は保存しました。友達への共有に失敗しました",
  shareAfterQuick: "この記録を友達に共有しますか。このアプリで友達になった人だけが見られます",
  shareNow: "共有する",
  skipShare: "共有しない",
  shareFollowsEdit: "変更は友達への共有内容にも反映されます",
  deleteWithShare: "友達への共有とリアクションも削除されます",
  deleteBatchPartial:
    "まとめ共有に含まれる場合、残りの本数だけ更新されます。0本になると共有も削除されます",
  reshareConfirm: "現在の友達に、新しい近況として共有します",
  kindDrinkLog: "飲んだ一杯",
  kindCellarAdd: "セラーに仲間入り",
  kindOpening: "開けた一本",
} as const;

export function socialBatchKindLabel(count: number): string {
  return `セラーに${count}本追加`;
}

function stripControlChars(value: string): string {
  return [...value]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
}

function hasControlChars(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function normalizeNickname(value: string): string {
  return stripControlChars(value).trim();
}

export function isMascotColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function mascotLightColor(hex: string): string {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!match?.[1]) {
    return "#B34A5A";
  }
  const raw = match[1];
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const mix = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * 0.35));
  return `#${[mix(r), mix(g), mix(b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export const nicknameSchema = z
  .string({ error: SOCIAL_MESSAGES.nickname })
  .transform(normalizeNickname)
  .refine((value) => value.length >= SOCIAL_NICKNAME_MIN && value.length <= SOCIAL_NICKNAME_MAX, {
    error: SOCIAL_MESSAGES.nickname,
  })
  .refine((value) => !hasControlChars(value) && !value.includes("\n"), {
    error: SOCIAL_MESSAGES.nicknameControl,
  });

export const mascotColorSchema = z
  .string({ error: SOCIAL_MESSAGES.mascotColor })
  .regex(/^#[0-9A-Fa-f]{6}$/, { error: SOCIAL_MESSAGES.mascotColor })
  .transform((value) => value.toUpperCase());

const uuid = z.string().uuid();

export const socialProfilePatchSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    avatarMode: z.enum(AVATAR_MODES).optional(),
    mascotColor: mascotColorSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: "変更する項目を指定してください" });

export type SocialProfilePatch = z.infer<typeof socialProfilePatchSchema>;

export const socialPreferencesPatchSchema = z
  .object({
    shareDefaultOn: z.boolean(),
  })
  .strict();

export const inviteTokenQuerySchema = z
  .object({
    token: z
      .string({ error: SOCIAL_MESSAGES.invite })
      .min(32, { error: SOCIAL_MESSAGES.invite })
      .max(128, { error: SOCIAL_MESSAGES.invite })
      .regex(/^[A-Za-z0-9_-]+$/, { error: SOCIAL_MESSAGES.invite }),
  })
  .strict();

export const invitationOwnerQuerySchema = z
  .object({
    token: inviteTokenQuerySchema.shape.token.optional(),
  })
  .strict();

export const createFriendRequestSchema = z
  .object({
    token: inviteTokenQuerySchema.shape.token,
  })
  .strict();

export const friendUserIdParamSchema = z.object({ userId: uuid }).strict();
export const socialIdParamSchema = z.object({ id: uuid }).strict();
export const socialPostPhotoParamSchema = z
  .object({
    postId: uuid,
    photoId: uuid,
  })
  .strict();
export const socialAvatarParamSchema = z.object({ userId: uuid }).strict();

export const socialFeedQuerySchema = z
  .object({
    limit: z.coerce
      .number({ error: SOCIAL_MESSAGES.limit })
      .int({ error: SOCIAL_MESSAGES.limit })
      .min(1, { error: SOCIAL_MESSAGES.limit })
      .max(50, { error: SOCIAL_MESSAGES.limit })
      .default(SOCIAL_FEED_LIMIT),
    cursor: z
      .string({ error: SOCIAL_MESSAGES.cursor })
      .min(1, { error: SOCIAL_MESSAGES.cursor })
      .max(256, { error: SOCIAL_MESSAGES.cursor })
      .optional(),
  })
  .strict();

export const socialShareSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("drink_log"), drinkLogId: uuid }).strict(),
  z.object({ kind: z.literal("opening"), openingEventId: uuid }).strict(),
  z
    .object({
      kind: z.literal("opening_with_log"),
      openingEventId: uuid,
      drinkLogId: uuid,
    })
    .strict(),
  z.object({ kind: z.literal("cellar_add"), bottleId: uuid }).strict(),
  z.object({ kind: z.literal("cellar_batch"), registrationBatchId: uuid }).strict(),
]);

export type SocialShareSource = z.infer<typeof socialShareSourceSchema>;

export const createSocialShareSchema = z
  .object({
    operationKey: operationKeySchema,
    source: socialShareSourceSchema,
  })
  .strict();

export const socialSourceLookupQuerySchema = z
  .object({
    bottleId: uuid.optional(),
    drinkLogId: uuid.optional(),
    registrationBatchId: uuid.optional(),
  })
  .strict()
  .refine((query) => Boolean(query.bottleId || query.drinkLogId || query.registrationBatchId), {
    error: SOCIAL_MESSAGES.share,
  });

export const socialSourceLookupSchema = z
  .object({
    openingEventId: z.string().nullable(),
    drinkLogPostId: z.string().nullable(),
    cellarAddPostId: z.string().nullable(),
    openingPostId: z.string().nullable(),
    batchPostId: z.string().nullable(),
  })
  .strict();

export type SocialSourceLookup = z.infer<typeof socialSourceLookupSchema>;

export function socialKindLabel(kind: SocialPostKind, itemCount: number): string {
  if (kind === "cellar_batch") {
    return socialBatchKindLabel(itemCount);
  }
  if (kind === "drink_log") {
    return SOCIAL_COPY.kindDrinkLog;
  }
  if (kind === "cellar_add") {
    return SOCIAL_COPY.kindCellarAdd;
  }
  return SOCIAL_COPY.kindOpening;
}

export const putReactionSchema = z
  .object({
    reactionTypeId: uuid,
  })
  .strict();

export const markNotificationReadSchema = z
  .object({
    read: z.literal(true),
  })
  .strict();

export const socialPublicProfileSchema = z
  .object({
    userId: z.string(),
    nickname: z.string(),
    avatarMode: z.enum(AVATAR_MODES),
    mascotColor: z.string(),
    hasCustomAvatar: z.boolean(),
  })
  .strict();

export type SocialPublicProfile = z.infer<typeof socialPublicProfileSchema>;

export const socialMeSchema = socialPublicProfileSchema.extend({
  profileCompleted: z.boolean(),
  friendCount: z.number().int(),
});

export type SocialMe = z.infer<typeof socialMeSchema>;

export const socialPreferencesSchema = z
  .object({
    shareDefaultOn: z.boolean(),
  })
  .strict();

export type SocialPreferences = z.infer<typeof socialPreferencesSchema>;

export const friendInvitationSchema = z
  .object({
    url: z.string(),
    expiresAt: z.string(),
    qrSvg: z.string(),
  })
  .strict();

export type FriendInvitation = z.infer<typeof friendInvitationSchema>;

export const invitePreviewSchema = z
  .object({
    status: z.enum(["ok", "unavailable"]),
    profile: socialPublicProfileSchema.nullable(),
    alreadyFriends: z.boolean(),
    alreadyRequested: z.boolean(),
    reversePending: z.boolean(),
  })
  .strict();

export type InvitePreview = z.infer<typeof invitePreviewSchema>;

export const friendRequestSchema = z
  .object({
    id: z.string(),
    status: z.enum(FRIEND_REQUEST_STATUSES),
    createdAt: z.string(),
    peer: socialPublicProfileSchema,
    direction: z.enum(["incoming", "outgoing"]),
  })
  .strict();

export type FriendRequest = z.infer<typeof friendRequestSchema>;

export const friendsListSchema = z
  .object({
    friends: z.array(socialPublicProfileSchema),
    incoming: z.array(friendRequestSchema),
    outgoing: z.array(friendRequestSchema),
  })
  .strict();

export type FriendsList = z.infer<typeof friendsListSchema>;

export const reactionTypeSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    emoji: z.string(),
    label: z.string(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
  })
  .strict();

export type ReactionType = z.infer<typeof reactionTypeSchema>;

export const socialReactionSummarySchema = z
  .object({
    typeId: z.string(),
    code: z.string(),
    emoji: z.string(),
    label: z.string(),
    count: z.number().int(),
    mine: z.boolean(),
  })
  .strict();

export type SocialReactionSummary = z.infer<typeof socialReactionSummarySchema>;

export const socialTastingSchema = z
  .object({
    appearance: z.string().nullable(),
    aroma: z.string().nullable(),
    taste: z.string().nullable(),
    finish: z.string().nullable(),
  })
  .strict();

export const socialPostItemSchema = z
  .object({
    name: z.string(),
    producer: z.string().nullable(),
    origin: z.string().nullable(),
    variety: z.string().nullable(),
    vintage: z.number().int().nullable(),
    photoIds: z.array(z.string()),
    drunkOn: z.string().nullable(),
    openedOn: z.string().nullable(),
    ratingX10: z.number().int().nullable(),
    comment: z.string().nullable(),
    tasting: socialTastingSchema.nullable(),
  })
  .strict();

export const socialPostSchema = z
  .object({
    id: z.string(),
    kind: z.enum(SOCIAL_POST_KINDS),
    publishedAt: z.string(),
    contentUpdatedAt: z.string(),
    edited: z.boolean(),
    author: socialPublicProfileSchema,
    items: z.array(socialPostItemSchema),
    reactions: z.array(socialReactionSummarySchema),
    canReact: z.boolean(),
    isAuthor: z.boolean(),
    sourceDrinkLogId: z.string().nullable(),
    sourceBottleId: z.string().nullable(),
  })
  .strict();

export type SocialPostItem = z.infer<typeof socialPostItemSchema>;
export type SocialPost = z.infer<typeof socialPostSchema>;

export const socialFeedSchema = z
  .object({
    items: z.array(socialPostSchema),
    nextCursor: z.string().nullable(),
    friendCount: z.number().int(),
  })
  .strict();

export type SocialFeed = z.infer<typeof socialFeedSchema>;

export const socialShareResultSchema = z
  .object({
    post: socialPostSchema.nullable(),
    created: z.boolean(),
  })
  .strict();

export const socialNotificationSchema = z
  .object({
    id: z.string(),
    type: z.enum(SOCIAL_NOTIFICATION_TYPES),
    createdAt: z.string(),
    readAt: z.string().nullable(),
    actor: socialPublicProfileSchema.nullable(),
    body: z.string(),
    href: z.string().nullable(),
    requestId: z.string().nullable(),
    canRespond: z.boolean(),
  })
  .strict();

export type SocialNotification = z.infer<typeof socialNotificationSchema>;

export const socialNotificationsSchema = z
  .object({
    items: z.array(socialNotificationSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const unreadCountSchema = z.object({ count: z.number().int() }).strict();

export const socialBlocksSchema = z
  .object({
    items: z.array(socialPublicProfileSchema),
  })
  .strict();

export const socialAvatarContentTypes = PHOTO_CONTENT_TYPES;

export function encodeFeedCursor(publishedAtMs: number, id: string): string {
  return `${publishedAtMs}:${id}`;
}

export function decodeFeedCursor(cursor: string): { publishedAtMs: number; id: string } | null {
  const sep = cursor.indexOf(":");
  if (sep <= 0) {
    return null;
  }
  const publishedAtMs = Number(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (!Number.isFinite(publishedAtMs) || !z.string().uuid().safeParse(id).success) {
    return null;
  }
  return { publishedAtMs, id };
}
