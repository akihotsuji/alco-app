import { describe, expect, it } from "vitest";
import { tokenFromInviteUrl } from "@/client/lib/social-invite.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { createBottlesResponseSchema } from "@/shared/bottles.ts";
import { drinkLogSchema } from "@/shared/drink-logs.ts";
import { photoMetaSchema } from "@/shared/photos.ts";
import {
  SOCIAL_CONTENT_CACHE_CONTROL,
  SOCIAL_MESSAGES,
  socialPostSchema,
} from "@/shared/social.ts";
import { makeJpeg } from "../image-fixtures.ts";
import {
  createTestApp,
  createTestUser,
  createUnverifiedTestUser,
  updateUserName,
} from "../test-helpers.ts";

type App = Awaited<ReturnType<typeof createTestApp>>["app"];

const ORIGIN = "http://localhost";
const LIKE_ID = "11111111-1111-4111-8111-111111111111";
const DELICIOUS_ID = "22222222-2222-4222-8222-222222222222";
const LOG_BASE = {
  drinkType: "wine",
  volumeMl: 125,
  abvPercent: 12,
  drinkName: "公開ワイン",
  memo: "非公開メモ",
  tastingNote: { ratingX10: 42, taste: "公開ひとこと" },
} as const;

function cookieHeaders(cookie: string) {
  return { Cookie: cookie, Origin: ORIGIN };
}

function jsonHeaders(cookie: string) {
  return { ...cookieHeaders(cookie), "Content-Type": "application/json" };
}

async function user(app: App, email: string) {
  return createTestUser(app, { name: email.split("@")[0] ?? "u", email, password: "password1" });
}

async function completeProfile(app: App, cookie: string, nickname: string) {
  const res = await app.request("/api/social/me", {
    method: "PATCH",
    headers: jsonHeaders(cookie),
    body: JSON.stringify({ nickname }),
  });
  expect(res.status).toBe(200);
}

async function inviteToken(app: App, cookie: string) {
  const res = await app.request("/api/friends/invitations", { headers: cookieHeaders(cookie) });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { url: string };
  const token = tokenFromInviteUrl(body.url);
  expect(token).toBeTruthy();
  return token ?? "";
}

async function becomeFriends(app: App, ownerCookie: string, requesterCookie: string) {
  const token = await inviteToken(app, ownerCookie);
  const created = await app.request("/api/friends/requests", {
    method: "POST",
    headers: jsonHeaders(requesterCookie),
    body: JSON.stringify({ token }),
  });
  expect(created.status).toBe(201);
  const body = (await created.json()) as { request: { id: string } };
  const accept = await app.request(`/api/friends/requests/${body.request.id}/accept`, {
    method: "POST",
    headers: cookieHeaders(ownerCookie),
  });
  expect(accept.status).toBe(200);
  return body.request.id;
}

async function createLog(app: App, cookie: string, extra: Record<string, unknown> = {}) {
  const res = await app.request("/api/drink-logs", {
    method: "POST",
    headers: jsonHeaders(cookie),
    body: JSON.stringify({ ...LOG_BASE, ...extra }),
  });
  expect(res.status).toBe(201);
  return drinkLogSchema.parse(await res.json());
}

async function share(app: App, cookie: string, source: unknown) {
  return app.request("/api/social/shares", {
    method: "POST",
    headers: jsonHeaders(cookie),
    body: JSON.stringify({ operationKey: crypto.randomUUID(), source }),
  });
}

async function createBottle(
  app: App,
  cookie: string,
  name: string,
  extra: Record<string, unknown> = {},
) {
  const res = await app.request("/api/bottles", {
    method: "POST",
    headers: jsonHeaders(cookie),
    body: JSON.stringify({ name, drinkType: "wine_red", ...extra }),
  });
  expect(res.status).toBe(201);
  const body = createBottlesResponseSchema.parse(await res.json());
  const bottle = body.items[0];
  expect(bottle?.id).toBeTruthy();
  return bottle?.id ?? "";
}

describe("友達・近況 API の認可", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const feed = await app.request("/api/social/feed");
    const friends = await app.request("/api/friends");
    expect(feed.status).toBe(401);
    expect(friends.status).toBe(401);
  });

  it("年齢未確認は 403", async () => {
    const { app } = await createTestApp();
    const unverified = await createUnverifiedTestUser(app, {
      name: "young",
      email: "young@example.com",
      password: "password1",
    });
    const res = await app.request("/api/social/me", { headers: { Cookie: unverified.cookie } });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("age_required");
  });

  it("プロフィール行なし・友達0では個人保存でき、共有は conflict", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const me = await app.request("/api/social/me", { headers: cookieHeaders(a.cookie) });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { nickname: string; profileCompleted: boolean };
    expect(meBody.nickname).toBe("a");
    expect(meBody.profileCompleted).toBe(true);

    const log = await createLog(app, a.cookie);
    const noFriends = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    expect(noFriends.status).toBe(409);
    const body = apiErrorBodySchema.parse(await noFriends.json());
    expect(body.fields?.[""]).toContain(SOCIAL_MESSAGES.noFriends);
    expect(body.conflict?.reason).not.toBe("profile_incomplete");

    const kept = await app.request(`/api/drink-logs/${log.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(kept.status).toBe(200);
  });

  it("表示名はアカウント名が正本で、旧 nickname では上書きしない", async () => {
    const { app } = await createTestApp();
    const a = await createTestUser(app, {
      name: "アカウント名",
      email: "name-canon@example.com",
      password: "password1",
    });
    const patched = await app.request("/api/social/me", {
      method: "PATCH",
      headers: jsonHeaders(a.cookie),
      body: JSON.stringify({ nickname: "旧友達名" }),
    });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { nickname: string }).nickname).toBe("アカウント名");

    const renamed = await updateUserName(app, a.cookie, "新しい表示名");
    expect(renamed.status).toBe(200);
    const after = await app.request("/api/social/me", { headers: cookieHeaders(a.cookie) });
    expect(((await after.json()) as { nickname: string }).nickname).toBe("新しい表示名");
  });

  it("空の表示名はユーザー、40文字は友達用制約で拒否しない", async () => {
    const { app } = await createTestApp();
    const empty = await createTestUser(app, {
      name: "",
      email: "empty-name@example.com",
      password: "password1",
    });
    const emptyMe = await app.request("/api/social/me", { headers: cookieHeaders(empty.cookie) });
    expect(((await emptyMe.json()) as { nickname: string }).nickname).toBe("ユーザー");

    const long = "あ".repeat(40);
    const named = await createTestUser(app, {
      name: long,
      email: "long-name@example.com",
      password: "password1",
    });
    const longMe = await app.request("/api/social/me", { headers: cookieHeaders(named.cookie) });
    expect(((await longMe.json()) as { nickname: string }).nickname).toBe(long);
  });

  it("プロフィール行なしでも招待・申請・承認できる", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "invite-a@example.com");
    const b = await user(app, "invite-b@example.com");
    const token = await inviteToken(app, a.cookie);
    const created = await app.request("/api/friends/requests", {
      method: "POST",
      headers: jsonHeaders(b.cookie),
      body: JSON.stringify({ token }),
    });
    expect(created.status).toBe(201);
    const requestId = ((await created.json()) as { request: { id: string } }).request.id;
    const accept = await app.request(`/api/friends/requests/${requestId}/accept`, {
      method: "POST",
      headers: cookieHeaders(a.cookie),
    });
    expect(accept.status).toBe(200);
    const friends = await app.request("/api/friends", { headers: { Cookie: a.cookie } });
    expect(
      ((await friends.json()) as { friends: { nickname: string }[] }).friends[0]?.nickname,
    ).toBe("invite-b");
  });

  it("同一オリジンでない更新は拒否する", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const res = await app.request("/api/social/me", {
      method: "PATCH",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "アリス" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("招待・申請・承認", () => {
  it("申請だけでは友達にならず、承認後に相互になる。辞退後は再承認できない", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    const token = await inviteToken(app, a.cookie);

    const preview = await app.request(`/api/friends/invitations/preview?token=${token}`, {
      headers: { Cookie: b.cookie },
    });
    expect(preview.status).toBe(200);
    expect(((await preview.json()) as { alreadyFriends: boolean }).alreadyFriends).toBe(false);

    const created = await app.request("/api/friends/requests", {
      method: "POST",
      headers: jsonHeaders(b.cookie),
      body: JSON.stringify({ token }),
    });
    expect(created.status).toBe(201);
    const requestId = ((await created.json()) as { request: { id: string } }).request.id;

    const before = await app.request("/api/friends", { headers: { Cookie: a.cookie } });
    const beforeBody = (await before.json()) as { friends: unknown[]; incoming: { id: string }[] };
    expect(beforeBody.friends).toEqual([]);
    expect(beforeBody.incoming[0]?.id).toBe(requestId);

    const decline = await app.request(`/api/friends/requests/${requestId}/decline`, {
      method: "POST",
      headers: cookieHeaders(a.cookie),
    });
    expect(decline.status).toBe(200);
    const acceptAfter = await app.request(`/api/friends/requests/${requestId}/accept`, {
      method: "POST",
      headers: cookieHeaders(a.cookie),
    });
    expect(acceptAfter.status).toBe(404);

    const token2 = await inviteToken(app, a.cookie);
    const again = await app.request("/api/friends/requests", {
      method: "POST",
      headers: jsonHeaders(b.cookie),
      body: JSON.stringify({ token: token2 }),
    });
    expect(again.status).toBe(201);
    const request2 = ((await again.json()) as { request: { id: string } }).request.id;
    const accept = await app.request(`/api/friends/requests/${request2}/accept`, {
      method: "POST",
      headers: cookieHeaders(a.cookie),
    });
    expect(accept.status).toBe(200);
    const friends = await app.request("/api/friends", { headers: { Cookie: a.cookie } });
    expect(((await friends.json()) as { friends: { userId: string }[] }).friends[0]?.userId).toBe(
      b.id,
    );
  });

  it("生トークン無しの再取得は旧リンクを無効にする", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    const first = await inviteToken(app, a.cookie);
    const secondRes = await app.request("/api/friends/invitations", {
      headers: cookieHeaders(a.cookie),
    });
    expect(secondRes.status).toBe(200);
    const second = tokenFromInviteUrl(((await secondRes.json()) as { url: string }).url);
    expect(second).not.toBe(first);
    const oldPreview = await app.request(`/api/friends/invitations/preview?token=${first}`, {
      headers: { Cookie: b.cookie },
    });
    expect(((await oldPreview.json()) as { status: string }).status).toBe("unavailable");
  });
});

describe("共有の可視性と世代", () => {
  it("受信対象かつ有効世代の友達だけが見られ、解除・再承認・後からの友達は旧投稿を見ない", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    const c = await user(app, "c@example.com");
    const d = await user(app, "d@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await completeProfile(app, c.cookie, "キャロル");
    await completeProfile(app, d.cookie, "デイブ");
    await becomeFriends(app, a.cookie, b.cookie);

    const log = await createLog(app, a.cookie);
    const shared = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    expect(shared.status).toBe(201);
    const post = socialPostSchema.parse(((await shared.json()) as { post: unknown }).post);
    expect(post.items[0]?.comment).toBe("公開ひとこと");
    expect(JSON.stringify(post)).not.toContain("非公開メモ");

    const asB = await app.request(`/api/social/posts/${post.id}`, {
      headers: { Cookie: b.cookie },
    });
    expect(asB.status).toBe(200);
    const asC = await app.request(`/api/social/posts/${post.id}`, {
      headers: { Cookie: c.cookie },
    });
    expect(asC.status).toBe(404);

    await becomeFriends(app, a.cookie, d.cookie);
    const asD = await app.request(`/api/social/posts/${post.id}`, {
      headers: { Cookie: d.cookie },
    });
    expect(asD.status).toBe(404);

    await app.request(`/api/friends/${b.id}`, {
      method: "DELETE",
      headers: cookieHeaders(a.cookie),
    });
    const afterUnfriend = await app.request(`/api/social/posts/${post.id}`, {
      headers: { Cookie: b.cookie },
    });
    expect(afterUnfriend.status).toBe(404);
    await becomeFriends(app, a.cookie, b.cookie);
    const afterRefriend = await app.request(`/api/social/posts/${post.id}`, {
      headers: { Cookie: b.cookie },
    });
    expect(afterRefriend.status).toBe(404);

    const feed = await app.request("/api/social/feed", { headers: { Cookie: b.cookie } });
    expect(((await feed.json()) as { items: unknown[] }).items).toEqual([]);
  });

  it("共有取消は投稿だけ消し、元記録は残す。記録削除は投稿も消す", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await becomeFriends(app, a.cookie, b.cookie);
    const log = await createLog(app, a.cookie);
    const shared = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    const postId = ((await shared.json()) as { post: { id: string } }).post.id;

    const unshare = await app.request(`/api/social/posts/${postId}`, {
      method: "DELETE",
      headers: cookieHeaders(a.cookie),
    });
    expect(unshare.status).toBe(200);
    expect(
      (await app.request(`/api/social/posts/${postId}`, { headers: { Cookie: b.cookie } })).status,
    ).toBe(404);
    expect(
      (await app.request(`/api/drink-logs/${log.id}`, { headers: { Cookie: a.cookie } })).status,
    ).toBe(200);

    const log2 = await createLog(app, a.cookie, { drinkName: "二杯目" });
    const shared2 = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log2.id });
    const post2 = ((await shared2.json()) as { post: { id: string } }).post.id;
    await app.request(`/api/drink-logs/${log2.id}`, {
      method: "DELETE",
      headers: cookieHeaders(a.cookie),
    });
    expect(
      (await app.request(`/api/social/posts/${post2}`, { headers: { Cookie: b.cookie } })).status,
    ).toBe(404);
  });

  it("編集は内容だけ追い、公開時刻と受信者は維持する", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await becomeFriends(app, a.cookie, b.cookie);
    const log = await createLog(app, a.cookie);
    const shared = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    const created = socialPostSchema.parse(((await shared.json()) as { post: unknown }).post);

    const patched = await app.request(`/api/drink-logs/${log.id}`, {
      method: "PATCH",
      headers: jsonHeaders(a.cookie),
      body: JSON.stringify({
        drinkName: "改名ワイン",
        tastingNote: { ratingX10: 48, taste: "更新ひとこと" },
      }),
    });
    expect(patched.status).toBe(200);

    const after = socialPostSchema.parse(
      await (
        await app.request(`/api/social/posts/${created.id}`, { headers: { Cookie: b.cookie } })
      ).json(),
    );
    expect(after.publishedAt).toBe(created.publishedAt);
    expect(after.items[0]?.name).toBe("改名ワイン");
    expect(after.items[0]?.comment).toBe("更新ひとこと");
  });
});

describe("開栓・まとめ登録・画像・リアクション", () => {
  it("開栓と続く記録の共有は1件。まとめ登録も1件", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await becomeFriends(app, a.cookie, b.cookie);

    const bottleId = await createBottle(app, a.cookie, "開栓ボトル");
    const consumed = await app.request(`/api/bottles/${bottleId}/consume`, {
      method: "POST",
      headers: cookieHeaders(a.cookie),
    });
    expect(consumed.status).toBe(200);
    const sources = await app.request(`/api/social/sources?bottleId=${bottleId}`, {
      headers: { Cookie: a.cookie },
    });
    const openingEventId = ((await sources.json()) as { openingEventId: string | null })
      .openingEventId;
    expect(openingEventId).toBeTruthy();

    const openingShare = await share(app, a.cookie, { kind: "opening", openingEventId });
    expect(openingShare.status).toBe(201);
    const openingPost = ((await openingShare.json()) as { post: { id: string } }).post;

    const log = await createLog(app, a.cookie, { bottleId, drinkName: "開栓の一杯" });
    const combined = await share(app, a.cookie, {
      kind: "opening_with_log",
      openingEventId,
      drinkLogId: log.id,
    });
    expect(combined.status).toBe(200);
    expect(((await combined.json()) as { post: { id: string }; created: boolean }).post.id).toBe(
      openingPost.id,
    );

    const batchId = crypto.randomUUID();
    await createBottle(app, a.cookie, "まとめ1", { registrationBatchId: batchId });
    await createBottle(app, a.cookie, "まとめ2", { registrationBatchId: batchId });
    const batchShare = await share(app, a.cookie, {
      kind: "cellar_batch",
      registrationBatchId: batchId,
    });
    expect(batchShare.status).toBe(201);
    const batchPost = socialPostSchema.parse(((await batchShare.json()) as { post: unknown }).post);
    expect(batchPost.kind).toBe("cellar_batch");
    expect(batchPost.items).toHaveLength(2);

    const again = await share(app, a.cookie, {
      kind: "cellar_batch",
      registrationBatchId: batchId,
    });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { post: { id: string } }).post.id).toBe(batchPost.id);
  });

  it("投稿画像は受信者だけ見え、Cache-Control は no-store。他人は 404", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    const c = await user(app, "c@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await completeProfile(app, c.cookie, "キャロル");
    await becomeFriends(app, a.cookie, b.cookie);

    const form = new FormData();
    form.set(
      "file",
      new File([Uint8Array.from(makeJpeg(320, 400))], "shot.jpg", { type: "image/jpeg" }),
    );
    const uploaded = await app.request("/api/photos", {
      method: "POST",
      headers: { Cookie: a.cookie, Origin: ORIGIN },
      body: form,
    });
    expect(uploaded.status).toBe(201);
    const photo = photoMetaSchema.parse(await uploaded.json());
    const log = await createLog(app, a.cookie, { photoIds: [photo.id] });
    const shared = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    const post = socialPostSchema.parse(((await shared.json()) as { post: unknown }).post);
    const photoId = post.items[0]?.photoIds[0];
    expect(photoId).toBe(photo.id);

    const url = `/api/social/posts/${post.id}/photos/${photoId}/content`;
    const asB = await app.request(url, { headers: { Cookie: b.cookie } });
    expect(asB.status).toBe(200);
    expect(asB.headers.get("Cache-Control")).toBe(SOCIAL_CONTENT_CACHE_CONTROL);
    const asC = await app.request(url, { headers: { Cookie: c.cookie } });
    expect(asC.status).toBe(404);
    const asAnon = await app.request(url);
    expect(asAnon.status).toBe(401);
  });

  it("リアクションは1人1種。作者は付けられない。通知は申請・承認・反応だけ", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await becomeFriends(app, a.cookie, b.cookie);
    const log = await createLog(app, a.cookie);
    const shared = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    const postId = ((await shared.json()) as { post: { id: string } }).post.id;

    const types = await app.request("/api/social/reaction-types", {
      headers: { Cookie: b.cookie },
    });
    expect(((await types.json()) as { items: unknown[] }).items).toHaveLength(7);

    const own = await app.request(`/api/social/posts/${postId}/reaction`, {
      method: "PUT",
      headers: jsonHeaders(a.cookie),
      body: JSON.stringify({ reactionTypeId: LIKE_ID }),
    });
    expect(own.status).toBe(404);

    const first = await app.request(`/api/social/posts/${postId}/reaction`, {
      method: "PUT",
      headers: jsonHeaders(b.cookie),
      body: JSON.stringify({ reactionTypeId: LIKE_ID }),
    });
    expect(first.status).toBe(200);
    const second = await app.request(`/api/social/posts/${postId}/reaction`, {
      method: "PUT",
      headers: jsonHeaders(b.cookie),
      body: JSON.stringify({ reactionTypeId: DELICIOUS_ID }),
    });
    expect(second.status).toBe(200);

    const viewed = socialPostSchema.parse(
      await (
        await app.request(`/api/social/posts/${postId}`, { headers: { Cookie: a.cookie } })
      ).json(),
    );
    const mine = viewed.reactions.filter((item) => item.count > 0);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.typeId).toBe(DELICIOUS_ID);

    const notices = await app.request("/api/social/notifications", {
      headers: { Cookie: a.cookie },
    });
    const items = ((await notices.json()) as { items: { type: string }[] }).items;
    expect(items.map((item) => item.type)).toContain("reaction");
    expect(
      items.every((item) => ["friend_request", "friend_accepted", "reaction"].includes(item.type)),
    ).toBe(true);
  });

  it("プロフィール投稿は友達の閲覧可能な投稿だけ。非友達は 404", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a-profile@example.com");
    const b = await user(app, "b-profile@example.com");
    const c = await user(app, "c-profile@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await completeProfile(app, c.cookie, "キャロル");
    await becomeFriends(app, a.cookie, b.cookie);
    const log = await createLog(app, a.cookie);
    const shared = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    expect(shared.status).toBe(201);
    const postId = ((await shared.json()) as { post: { id: string } }).post.id;

    const asB = await app.request(`/api/social/profiles/${a.id}/posts`, {
      headers: { Cookie: b.cookie },
    });
    expect(asB.status).toBe(200);
    const bBody = (await asB.json()) as { items: { id: string }[] };
    expect(bBody.items.map((item) => item.id)).toEqual([postId]);

    await becomeFriends(app, a.cookie, c.cookie);
    const asC = await app.request(`/api/social/profiles/${a.id}/posts`, {
      headers: { Cookie: c.cookie },
    });
    expect(((await asC.json()) as { items: unknown[] }).items).toEqual([]);

    const stranger = await user(app, "d-profile@example.com");
    await completeProfile(app, stranger.cookie, "デイブ");
    expect(
      (
        await app.request(`/api/social/profiles/${a.id}/posts`, {
          headers: { Cookie: stranger.cookie },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(`/api/social/profiles/${a.id}`, {
          headers: { Cookie: stranger.cookie },
        })
      ).status,
    ).toBe(404);
  });

  it("ブロックすると旧投稿は見えず、フィードにも出ない", async () => {
    const { app } = await createTestApp();
    const a = await user(app, "a@example.com");
    const b = await user(app, "b@example.com");
    await completeProfile(app, a.cookie, "アリス");
    await completeProfile(app, b.cookie, "ボブ");
    await becomeFriends(app, a.cookie, b.cookie);
    const log = await createLog(app, a.cookie);
    const shared = await share(app, a.cookie, { kind: "drink_log", drinkLogId: log.id });
    const postId = ((await shared.json()) as { post: { id: string } }).post.id;

    const blocked = await app.request(`/api/friends/blocks/${b.id}`, {
      method: "POST",
      headers: cookieHeaders(a.cookie),
    });
    expect(blocked.status).toBe(200);
    expect(
      (await app.request(`/api/social/posts/${postId}`, { headers: { Cookie: b.cookie } })).status,
    ).toBe(404);
  });
});
