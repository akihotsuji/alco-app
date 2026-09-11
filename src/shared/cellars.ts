import { z } from "zod";
import {
  CELLAR_ACTIVITY_ACTIONS,
  CELLAR_DEFAULT_SHARED_NAME,
  CELLAR_KINDS,
  CELLAR_MOVE_MAX,
  CELLAR_NAME_MAX_LENGTH,
  CELLAR_TRANSFER_STATUSES,
  type CellarKind,
} from "./constants.ts";

export const CELLAR_MESSAGES = {
  name: `1文字以上${CELLAR_NAME_MAX_LENGTH}文字以内で入力してください`,
  operationKey: "操作キーが正しくありません",
  token: "招待リンクが正しくありません",
  expectedVersion: "最新の内容を確認してから保存してください",
  moveEmpty: "移すボトルを選んでください",
  moveMax: `一度に移せるのは${CELLAR_MOVE_MAX}本までです`,
  confirmName: "削除するにはセラー名を入力してください",
  confirmNameMismatch: "セラー名が一致しません",
} as const;

export const operationKeySchema = z
  .string({ error: CELLAR_MESSAGES.operationKey })
  .uuid({ error: CELLAR_MESSAGES.operationKey });

export const cellarNameSchema = z
  .string({ error: CELLAR_MESSAGES.name })
  .trim()
  .min(1, { error: CELLAR_MESSAGES.name })
  .max(CELLAR_NAME_MAX_LENGTH, { error: CELLAR_MESSAGES.name });

export const inviteTokenSchema = z
  .string({ error: CELLAR_MESSAGES.token })
  .min(32, { error: CELLAR_MESSAGES.token })
  .max(128, { error: CELLAR_MESSAGES.token })
  .regex(/^[A-Za-z0-9_-]+$/, { error: CELLAR_MESSAGES.token });

export const cellarIdParamSchema = z.object({ id: z.string().uuid() }).strict();

export const cellarMemberIdParamSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
  })
  .strict();

export const createCellarSchema = z
  .object({
    name: cellarNameSchema.optional(),
    operationKey: operationKeySchema,
  })
  .strict();
export type CreateCellarInput = z.infer<typeof createCellarSchema>;

export const updateCellarSchema = z
  .object({
    name: cellarNameSchema,
    operationKey: operationKeySchema,
  })
  .strict();
export type UpdateCellarInput = z.infer<typeof updateCellarSchema>;

export const deleteCellarSchema = z
  .object({
    confirmName: cellarNameSchema,
    operationKey: operationKeySchema,
  })
  .strict();
export type DeleteCellarInput = z.infer<typeof deleteCellarSchema>;

export const createInvitationSchema = z
  .object({
    operationKey: operationKeySchema,
  })
  .strict();

export const invitationIdParamSchema = z
  .object({
    id: z.string().uuid(),
    invitationId: z.string().uuid(),
  })
  .strict();

export const inviteTokenBodySchema = z
  .object({
    token: inviteTokenSchema,
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: inviteTokenSchema,
    operationKey: operationKeySchema,
  })
  .strict();
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const leaveCellarSchema = z
  .object({
    operationKey: operationKeySchema,
  })
  .strict();

export const removeMemberSchema = z
  .object({
    operationKey: operationKeySchema,
  })
  .strict();

export const createTransferSchema = z
  .object({
    toUserId: z.string().uuid(),
    operationKey: operationKeySchema,
  })
  .strict();
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const transferActionSchema = z
  .object({
    operationKey: operationKeySchema,
  })
  .strict();

export const transferIdParamSchema = z
  .object({
    id: z.string().uuid(),
    transferId: z.string().uuid(),
  })
  .strict();

export const moveBottlesItemSchema = z
  .object({
    bottleId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const moveBottlesSchema = z
  .object({
    items: z
      .array(moveBottlesItemSchema)
      .min(1, { error: CELLAR_MESSAGES.moveEmpty })
      .max(CELLAR_MOVE_MAX, { error: CELLAR_MESSAGES.moveMax }),
    operationKey: operationKeySchema,
  })
  .strict();
export type MoveBottlesInput = z.infer<typeof moveBottlesSchema>;

export const cellarActivityQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).max(256).optional(),
  })
  .strict();

export const cellarKindSchema = z.enum(CELLAR_KINDS);
export const cellarTransferStatusSchema = z.enum(CELLAR_TRANSFER_STATUSES);
export const cellarActivityActionSchema = z.enum(CELLAR_ACTIVITY_ACTIONS);

export const cellarSummarySchema = z
  .object({
    id: z.string(),
    kind: cellarKindSchema,
    name: z.string(),
    role: z.enum(["owner", "member"]),
    memberCount: z.number().int().min(1),
    revision: z.number().int().min(1),
    bottleCount: z.number().int().min(0),
  })
  .strict();
export type CellarSummary = z.infer<typeof cellarSummarySchema>;

export const cellarsResponseSchema = z
  .object({
    items: z.array(cellarSummarySchema),
  })
  .strict();
export type CellarsResponse = z.infer<typeof cellarsResponseSchema>;

export const cellarRevisionSchema = z
  .object({
    id: z.string(),
    revision: z.number().int().min(1),
  })
  .strict();
export type CellarRevision = z.infer<typeof cellarRevisionSchema>;

export const cellarMemberSchema = z
  .object({
    userId: z.string().nullable(),
    displayName: z.string(),
    role: z.enum(["owner", "member"]),
    joinedAt: z.string(),
  })
  .strict();
export type CellarMember = z.infer<typeof cellarMemberSchema>;

export const cellarMembersResponseSchema = z
  .object({
    items: z.array(cellarMemberSchema),
  })
  .strict();

export const cellarInvitationSchema = z
  .object({
    id: z.string(),
    expiresAt: z.string(),
    revokedAt: z.string().nullable(),
    usedAt: z.string().nullable(),
  })
  .strict();
export type CellarInvitation = z.infer<typeof cellarInvitationSchema>;

export const cellarInvitationsResponseSchema = z
  .object({
    items: z.array(cellarInvitationSchema),
  })
  .strict();

export const createdInvitationSchema = cellarInvitationSchema.extend({
  url: z.string(),
});
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

export const invitationPreviewStatuses = [
  "joinable",
  "already_member",
  "already_in_other",
  "unavailable",
] as const;
export type InvitationPreviewStatus = (typeof invitationPreviewStatuses)[number];

export const invitationPreviewSchema = z
  .object({
    status: z.enum(invitationPreviewStatuses),
    cellarId: z.string().nullable(),
    cellarName: z.string().nullable(),
    inviterName: z.string().nullable(),
    memberCount: z.number().int().min(0).nullable(),
  })
  .strict();
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const cellarTransferSchema = z
  .object({
    id: z.string(),
    fromUserId: z.string().nullable(),
    toUserId: z.string().nullable(),
    status: cellarTransferStatusSchema,
    expiresAt: z.string(),
    createdAt: z.string(),
  })
  .strict();
export type CellarTransfer = z.infer<typeof cellarTransferSchema>;

export const cellarActivityItemSchema = z
  .object({
    id: z.string(),
    action: cellarActivityActionSchema,
    actorName: z.string(),
    bottleName: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
export type CellarActivityItem = z.infer<typeof cellarActivityItemSchema>;

export const cellarActivityResponseSchema = z
  .object({
    items: z.array(cellarActivityItemSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const cellarDetailSchema = cellarSummarySchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
  pendingTransfer: cellarTransferSchema.nullable(),
});
export type CellarDetail = z.infer<typeof cellarDetailSchema>;

export const BOTTLE_LIST_SCOPES = ["personal", "accessible"] as const;
export type BottleListScope = (typeof BOTTLE_LIST_SCOPES)[number];

export function defaultSharedCellarName(name: string | undefined): string {
  const trimmed = name?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : CELLAR_DEFAULT_SHARED_NAME;
}

export function cellarRole(kind: CellarKind, ownerUserId: string, userId: string): "owner" | "member" {
  if (kind === "personal" || ownerUserId === userId) {
    return "owner";
  }
  return "member";
}

export const CELLAR_COPY = {
  shareBoundary:
    "このセラーのボトルと写真は、参加した人全員が追加・編集・削除できます。飲酒記録とノートは共有されません。",
  inviteHint: "リンクを受け取った人が参加できます。招待したい相手にだけ送ってください",
  inviteTtl: "24時間以内・1人用",
  inviteUnavailable:
    "この招待リンクは利用できません。招待した人に新しいリンクを作ってもらってください。",
  moveWarning:
    "写真・購入情報・メモも共有されます。飲酒記録とノートは共有されません。共有へ移したボトルは、脱退しても共有セラーに残ります。",
  leaveWarning:
    "追加したボトルと写真は共有セラーに残ります。自分の飲酒記録とノートは残ります。",
  deleteShared:
    "全ボトルと写真が全員のセラーから消えます。各自の飲酒記録とノートは残ります。",
  sharedMemoLabel: "メモ（参加者に共有）",
  syncHint: "変更は数秒で反映されます",
  syncFailed: "最新の変更を確認できません。再試行",
  updated: "セラーを更新しました",
  newBottles: "新しいボトルが追加されました",
  conflictEdit: "別のメンバーが更新しました。保存前に変更を確認してください",
  conflictDeleted: "このボトルは削除されたか、利用できなくなりました",
  alreadyConsumed: "すでに開栓されています",
  saveDestinationShared: "参加者全員に表示されます",
} as const;
