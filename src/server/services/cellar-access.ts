import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppBatchDb, AppSqliteDb } from "@/db/index.ts";
import {
  bottles,
  cellarActivity,
  cellarMembers,
  cellars,
  userCellarSlots,
  user as users,
} from "@/db/schema.ts";
import { CELLAR_COPY, cellarRole } from "@/shared/cellars.ts";
import {
  CELLAR_PERSONAL_NAME,
  type CellarActivityAction,
  LEFT_MEMBER_DISPLAY_NAME,
} from "@/shared/constants.ts";
import { ApiError } from "../errors.ts";

export type CellarRow = typeof cellars.$inferSelect;

export type CellarAccess = CellarRow & {
  role: "owner" | "member";
};

export async function ensurePersonalCellar(
  db: AppBatchDb,
  userId: string,
  now: Date = new Date(),
): Promise<string> {
  const [slot] = await db
    .select({ personalCellarId: userCellarSlots.personalCellarId })
    .from(userCellarSlots)
    .where(eq(userCellarSlots.userId, userId));
  if (slot) {
    return slot.personalCellarId;
  }

  const cellarId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(cellars).values({
        id: cellarId,
        kind: "personal",
        name: CELLAR_PERSONAL_NAME,
        ownerUserId: userId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(cellarMembers).values({
        id: memberId,
        cellarId,
        userId,
        joinedAt: now,
      }),
      db.insert(userCellarSlots).values({
        userId,
        personalCellarId: cellarId,
        sharedCellarId: null,
      }),
    ]);
    return cellarId;
  } catch (error) {
    const [again] = await db
      .select({ personalCellarId: userCellarSlots.personalCellarId })
      .from(userCellarSlots)
      .where(eq(userCellarSlots.userId, userId));
    if (again) {
      return again.personalCellarId;
    }
    throw error;
  }
}

export async function requireCellarMember(
  db: AppBatchDb,
  userId: string,
  cellarId: string,
): Promise<CellarAccess> {
  const [row] = await db
    .select({
      cellar: cellars,
      memberUserId: cellarMembers.userId,
    })
    .from(cellars)
    .innerJoin(
      cellarMembers,
      and(eq(cellarMembers.cellarId, cellars.id), eq(cellarMembers.userId, userId)),
    )
    .where(eq(cellars.id, cellarId));
  if (!row) {
    throw new ApiError("not_found");
  }
  return {
    ...row.cellar,
    role: cellarRole(row.cellar.kind, row.cellar.ownerUserId, userId),
  };
}

export async function requireCellarOwner(
  db: AppBatchDb,
  userId: string,
  cellarId: string,
): Promise<CellarAccess> {
  const access = await requireCellarMember(db, userId, cellarId);
  if (access.role !== "owner" || access.kind === "personal") {
    throw new ApiError("not_found");
  }
  return access;
}

export async function resolveBottleCellarId(
  db: AppBatchDb,
  userId: string,
  cellarId: string | undefined,
): Promise<string> {
  if (!cellarId) {
    return ensurePersonalCellar(db, userId);
  }
  await requireCellarMember(db, userId, cellarId);
  return cellarId;
}

export type AccessibleBottle = typeof bottles.$inferSelect & {
  cellarKind: "personal" | "shared";
};

export async function requireAccessibleBottle(
  db: AppSqliteDb,
  userId: string,
  bottleId: string,
): Promise<AccessibleBottle> {
  const [row] = await db
    .select({
      bottle: bottles,
      cellarKind: cellars.kind,
    })
    .from(bottles)
    .innerJoin(cellars, eq(cellars.id, bottles.cellarId))
    .innerJoin(
      cellarMembers,
      and(eq(cellarMembers.cellarId, bottles.cellarId), eq(cellarMembers.userId, userId)),
    )
    .where(eq(bottles.id, bottleId));
  if (!row) {
    throw new ApiError("not_found");
  }
  return { ...row.bottle, cellarKind: row.cellarKind };
}

export function memberCondition(userId: string) {
  return sql`${bottles.cellarId} IN (SELECT ${cellarMembers.cellarId} FROM ${cellarMembers} WHERE ${cellarMembers.userId} = ${userId})`;
}

/** 個人セラーが未作成ならヒットしない（一覧ではスロットを作らない） */
export function personalCellarSql(userId: string) {
  return sql`${bottles.cellarId} = (SELECT ${userCellarSlots.personalCellarId} FROM ${userCellarSlots} WHERE ${userCellarSlots.userId} = ${userId})`;
}

export async function listMemberCellarIds(db: AppBatchDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ cellarId: cellarMembers.cellarId })
    .from(cellarMembers)
    .where(eq(cellarMembers.userId, userId));
  return rows.map((row) => row.cellarId);
}

export async function displayNamesById(
  db: AppBatchDb,
  userIds: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (unique.length === 0) {
    return names;
  }
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, unique));
  for (const row of rows) {
    names.set(row.id, row.name || LEFT_MEMBER_DISPLAY_NAME);
  }
  return names;
}

export function actorDisplayName(
  userId: string | null | undefined,
  names: Map<string, string>,
): string {
  if (!userId) {
    return LEFT_MEMBER_DISPLAY_NAME;
  }
  return names.get(userId) ?? LEFT_MEMBER_DISPLAY_NAME;
}

export function bumpCellarRevision(db: AppBatchDb, cellarId: string, now: Date) {
  return db
    .update(cellars)
    .set({
      revision: sql`${cellars.revision} + 1`,
      updatedAt: now,
    })
    .where(eq(cellars.id, cellarId));
}

export function recordActivity(
  db: AppBatchDb,
  input: {
    cellarId: string;
    actorUserId: string | null;
    action: CellarActivityAction;
    bottleId?: string | null;
    bottleName?: string | null;
    now: Date;
  },
) {
  return db.insert(cellarActivity).values({
    id: crypto.randomUUID(),
    cellarId: input.cellarId,
    actorUserId: input.actorUserId,
    action: input.action,
    bottleId: input.bottleId ?? null,
    bottleName: input.bottleName ?? null,
    createdAt: input.now,
  });
}

export function assertSharedVersion(
  cellarKind: "personal" | "shared",
  expectedVersion: number | undefined,
): void {
  if (cellarKind === "shared" && expectedVersion === undefined) {
    throw new ApiError("validation_error", {
      fields: { expectedVersion: [CELLAR_COPY.conflictEdit] },
    });
  }
}

export function membershipSql(userId: string) {
  return sql`${bottles.cellarId} IN (SELECT cellar_id FROM cellar_members WHERE user_id = ${userId})`;
}
