import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import { myDrinks } from "@/db/schema.ts";
import type {
  CreateMyDrinkInput,
  MyDrink,
  MyDrinksQuery,
  MyDrinksResponse,
  OneTapDrinkLogInput,
  UpdateMyDrinkInput,
} from "@/shared/my-drinks.ts";
import { MY_DRINK_MAX_COUNT, MY_DRINK_MESSAGES } from "@/shared/my-drinks.ts";
import { ApiError } from "../errors.ts";
import { takeLimitPlusOne } from "../lib/keyset-page.ts";
import { createDrinkLog } from "./drink-logs.ts";

type MyDrinkRow = typeof myDrinks.$inferSelect;

const cursorPayloadSchema = z
  .object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })
  .strict();

function toIso(value: Date | number): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toMyDrink(row: MyDrinkRow): MyDrink {
  return {
    id: row.id,
    name: row.name,
    drinkType: row.drinkType,
    volumeMl: row.volumeMl,
    abvPercent: row.abvPercent,
    sortOrder: row.sortOrder,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function cursorError(): ApiError {
  return new ApiError("validation_error", {
    fields: { cursor: [MY_DRINK_MESSAGES.cursor] },
  });
}

function encodeCursor(row: MyDrinkRow): string {
  return btoa(JSON.stringify({ id: row.id, sortOrder: row.sortOrder }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeCursor(cursor: string): z.infer<typeof cursorPayloadSchema> {
  try {
    const base64 = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    const parsed = cursorPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw cursorError();
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw cursorError();
  }
}

export async function listMyDrinks(
  db: AppBatchDb,
  userId: string,
  query: MyDrinksQuery,
): Promise<MyDrinksResponse> {
  const conditions = [eq(myDrinks.userId, userId)];
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const [anchor] = await db
      .select({ id: myDrinks.id, sortOrder: myDrinks.sortOrder })
      .from(myDrinks)
      .where(and(eq(myDrinks.id, cursor.id), eq(myDrinks.userId, userId)));
    if (!anchor || anchor.sortOrder !== cursor.sortOrder) {
      throw cursorError();
    }
    conditions.push(
      sql`(${myDrinks.sortOrder} > ${cursor.sortOrder} or (${myDrinks.sortOrder} = ${cursor.sortOrder} and ${myDrinks.id} > ${cursor.id}))`,
    );
  }

  const fetched = await db
    .select()
    .from(myDrinks)
    .where(and(...conditions))
    .orderBy(asc(myDrinks.sortOrder), asc(myDrinks.id))
    .limit(query.limit + 1);
  const { page, hasMore } = takeLimitPlusOne(fetched, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(toMyDrink),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

export async function createMyDrink(input: {
  db: AppBatchDb;
  userId: string;
  body: CreateMyDrinkInput;
  now?: Date;
}): Promise<MyDrink> {
  let sortOrder = input.body.sortOrder;
  if (sortOrder === undefined) {
    const [last] = await input.db
      .select({ sortOrder: myDrinks.sortOrder })
      .from(myDrinks)
      .where(eq(myDrinks.userId, input.userId))
      .orderBy(desc(myDrinks.sortOrder))
      .limit(1);
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const now = input.now ?? new Date();
  const id = crypto.randomUUID();
  const [row] = await input.db
    .insert(myDrinks)
    .select(
      sql`SELECT ${id}, ${input.userId}, ${input.body.name}, ${input.body.drinkType},
          ${input.body.volumeMl}, ${input.body.abvPercent}, ${sortOrder}, ${now.getTime()},
          ${now.getTime()}
        WHERE (
          SELECT count(*) FROM ${myDrinks} WHERE ${myDrinks.userId} = ${input.userId}
        ) < ${MY_DRINK_MAX_COUNT}`,
    )
    .returning();
  if (!row) {
    throw new ApiError("validation_error", {
      fields: { count: [MY_DRINK_MESSAGES.count] },
    });
  }
  return toMyDrink(row);
}

export async function getOwnMyDrink(
  db: AppBatchDb,
  userId: string,
  myDrinkId: string,
): Promise<MyDrink> {
  const [row] = await db
    .select()
    .from(myDrinks)
    .where(and(eq(myDrinks.id, myDrinkId), eq(myDrinks.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  return toMyDrink(row);
}

export async function updateMyDrink(input: {
  db: AppBatchDb;
  userId: string;
  myDrinkId: string;
  body: UpdateMyDrinkInput;
  now?: Date;
}): Promise<MyDrink> {
  const [row] = await input.db
    .update(myDrinks)
    .set({ ...input.body, updatedAt: input.now ?? new Date() })
    .where(and(eq(myDrinks.id, input.myDrinkId), eq(myDrinks.userId, input.userId)))
    .returning();
  if (!row) {
    throw new ApiError("not_found");
  }
  return toMyDrink(row);
}

export async function deleteMyDrink(
  db: AppBatchDb,
  userId: string,
  myDrinkId: string,
): Promise<void> {
  const [deleted] = await db
    .delete(myDrinks)
    .where(and(eq(myDrinks.id, myDrinkId), eq(myDrinks.userId, userId)))
    .returning({ id: myDrinks.id });
  if (!deleted) {
    throw new ApiError("not_found");
  }
}

export async function createDrinkLogFromMyDrink(input: {
  db: AppBatchDb;
  userId: string;
  myDrinkId: string;
  body: OneTapDrinkLogInput;
}) {
  const [preset] = await input.db
    .select()
    .from(myDrinks)
    .where(and(eq(myDrinks.id, input.myDrinkId), eq(myDrinks.userId, input.userId)));
  if (!preset) {
    throw new ApiError("not_found");
  }

  return createDrinkLog({
    db: input.db,
    userId: input.userId,
    body: {
      drinkType: preset.drinkType,
      volumeMl: preset.volumeMl,
      abvPercent: preset.abvPercent,
      myDrinkId: preset.id,
      drunkAt: input.body.drunkAt,
      memo: input.body.memo,
    },
  });
}
