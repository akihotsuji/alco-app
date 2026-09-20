import type { BottleStatus, DrinkType } from "@/shared/constants.ts";
import { drinkLogSchema } from "@/shared/drink-logs.ts";
import { photoMetaSchema } from "@/shared/photos.ts";
import { tastingNoteSchema } from "@/shared/tasting-notes.ts";
import { tokyoEveningIso, tokyoToday } from "@/shared/tokyo-date.ts";
import { makeJpeg } from "./image-fixtures.ts";
import { createTestUser, seedOwnedBottle as insertOwnedBottle } from "./test-helpers.ts";

/**
 * ノート API テスト用のボトル / 写真 / セッション一式。
 * 作成は記録 POST の `tastingNote` 経由。
 */
export type NoteTestCtx = Awaited<ReturnType<typeof import("./test-helpers.ts").createTestApp>>;
export type NoteTestApp = NoteTestCtx["app"];

export const NOTE_TODAY = tokyoToday();
export const NOTE_OWN_BOTTLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const NOTE_OTHER_BOTTLE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const NOTE_MISSING_ID = "99999999-9999-4999-8999-999999999999";

export const NOTE_HAND = {
  drinkName: "サンプル赤",
  drinkType: "wine" as const,
  ratingX10: 45,
} as const;

export async function noteSession(app: NoteTestApp, email: string) {
  const user = await createTestUser(app, {
    name: email.split("@")[0] ?? "user",
    email,
    password: "password1",
  });
  return { cookie: user.cookie, userId: user.id };
}

export function postDrinkLog(app: NoteTestApp, cookie: string, body: unknown) {
  return app.request("/api/drink-logs", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function patchDrinkLog(app: NoteTestApp, cookie: string, id: string, body: unknown) {
  return app.request(`/api/drink-logs/${id}`, {
    method: "PATCH",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postNote(app: NoteTestApp, cookie: string, body: unknown) {
  return app.request("/api/tasting-notes", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getNotes(app: NoteTestApp, cookie: string, search = "") {
  const suffix = search ? `?${search}` : "";
  return app.request(`/api/tasting-notes${suffix}`, { headers: { Cookie: cookie } });
}

export function getNote(app: NoteTestApp, cookie: string, id: string) {
  return app.request(`/api/tasting-notes/${id}`, { headers: { Cookie: cookie } });
}

export function patchNote(app: NoteTestApp, cookie: string, id: string, body: unknown) {
  return app.request(`/api/tasting-notes/${id}`, {
    method: "PATCH",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteNote(app: NoteTestApp, cookie: string, id: string) {
  return app.request(`/api/tasting-notes/${id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
}

export async function createHandNote(
  app: NoteTestApp,
  cookie: string,
  body: Record<string, unknown> = {},
) {
  const {
    photoIds,
    bottleId,
    drinkName,
    drinkType,
    ratingX10,
    appearance,
    aroma,
    taste,
    finish,
    tastedOn,
  } = body;
  const res = await postDrinkLog(app, cookie, {
    drinkType: drinkType ?? NOTE_HAND.drinkType,
    drinkName: drinkName ?? NOTE_HAND.drinkName,
    volumeMl: 125,
    abvPercent: 12,
    ...(typeof tastedOn === "string" ? { drunkAt: tokyoEveningIso(tastedOn) } : {}),
    ...(bottleId ? { bottleId } : {}),
    tastingNote: {
      ratingX10: ratingX10 ?? NOTE_HAND.ratingX10,
      ...(appearance !== undefined ? { appearance } : {}),
      ...(aroma !== undefined ? { aroma } : {}),
      ...(taste !== undefined ? { taste } : {}),
      ...(finish !== undefined ? { finish } : {}),
      ...(photoIds ? { photoIds } : {}),
    },
  });
  if (res.status !== 201) {
    throw new Error(`ノート作成に失敗しました: ${res.status}`);
  }
  const log = drinkLogSchema.parse(await res.json());
  if (!log.tastingNote) {
    throw new Error("記録にノートが付いていません");
  }
  return tastingNoteSchema.parse(await (await getNote(app, cookie, log.tastingNote.id)).json());
}

export async function uploadNotePhoto(app: NoteTestApp, cookie: string) {
  const form = new FormData();
  form.set(
    "file",
    new File([Uint8Array.from(makeJpeg(320, 400))], "shot.jpg", { type: "image/jpeg" }),
  );
  const res = await app.request("/api/photos", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  if (res.status !== 201) {
    throw new Error(`写真アップロードに失敗しました: ${res.status}`);
  }
  return photoMetaSchema.parse(await res.json());
}

export async function seedOwnedBottle(
  ctx: NoteTestCtx,
  id: string,
  userId: string,
  name: string,
  status: BottleStatus = "sealed",
  drinkType: DrinkType = "beer",
  extra: { producer?: string; origin?: string; variety?: string; vintage?: number } = {},
) {
  await insertOwnedBottle(ctx.db, {
    id,
    userId,
    name,
    drinkType,
    status,
    producer: extra.producer ?? null,
    origin: extra.origin ?? null,
    variety: extra.variety ?? null,
    vintage: extra.vintage ?? null,
  });
}
