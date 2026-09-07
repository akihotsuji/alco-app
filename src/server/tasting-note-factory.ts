import { bottles } from "@/db/schema.ts";
import type { BottleStatus, DrinkType } from "@/shared/constants.ts";
import { photoMetaSchema } from "@/shared/photos.ts";
import { tastingNoteSchema } from "@/shared/tasting-notes.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { makeJpeg } from "./image-fixtures.ts";
import { createTestUser } from "./test-helpers.ts";

/**
 * ノート API テスト用のボトル / 写真 / セッション一式。
 * セットアップを 1 箇所に集め、5-05 の認可ケースで使い回す。
 */
export type NoteTestCtx = Awaited<ReturnType<typeof import("./test-helpers.ts").createTestApp>>;
export type NoteTestApp = NoteTestCtx["app"];

export const NOTE_TODAY = tokyoToday();
export const NOTE_OWN_BOTTLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const NOTE_OTHER_BOTTLE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const NOTE_MISSING_ID = "99999999-9999-4999-8999-999999999999";

export const NOTE_HAND = {
  drinkName: "サンプル赤",
  drinkType: "wine",
  tastedOn: NOTE_TODAY,
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
  const res = await postNote(app, cookie, { ...NOTE_HAND, ...body });
  if (res.status !== 201) {
    throw new Error(`ノート作成に失敗しました: ${res.status}`);
  }
  return tastingNoteSchema.parse(await res.json());
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
) {
  const now = new Date();
  await ctx.db.insert(bottles).values({
    id,
    userId,
    name,
    drinkType,
    status,
    createdAt: now,
    updatedAt: now,
  });
}
