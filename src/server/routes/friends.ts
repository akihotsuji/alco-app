import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  createFriendRequestSchema,
  friendUserIdParamSchema,
  inviteTokenQuerySchema,
  socialIdParamSchema,
} from "@/shared/social.ts";
import type { AppEnv } from "../app-env.ts";
import { assertSameOrigin } from "../services/origin.ts";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  createFriendRequest,
  createOrGetInvitation,
  currentInvitationForOwner,
  declineFriendRequest,
  listBlocks,
  listFriends,
  previewInvitation,
  reissueInvitation,
  unblockUser,
  unfriend,
} from "../services/friends.ts";
import { SOCIAL_CONTENT_CACHE_CONTROL } from "@/shared/social.ts";
import { validate } from "../validation.ts";

export type FriendsRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
};

function originOf(c: Context<AppEnv>): string {
  return new URL(c.req.url).origin;
}

function noStore(c: Context<AppEnv>) {
  c.header("Cache-Control", SOCIAL_CONTENT_CACHE_CONTROL);
}

export function createFriendsRoute(deps: FriendsRouteDeps) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      noStore(c);
      return c.json(await listFriends(deps.getDb(c), c.get("user").id));
    })
    .get("/invitations", async (c) => {
      noStore(c);
      const token = c.req.query("token");
      return c.json(
        await currentInvitationForOwner({
          db: deps.getDb(c),
          userId: c.get("user").id,
          origin: originOf(c),
          token: token || undefined,
        }),
      );
    })
    .post("/invitations", async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await createOrGetInvitation({
          db: deps.getDb(c),
          userId: c.get("user").id,
          origin: originOf(c),
        }),
        201,
      );
    })
    .post("/invitations/reissue", async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await reissueInvitation({
          db: deps.getDb(c),
          userId: c.get("user").id,
          origin: originOf(c),
        }),
      );
    })
    .get("/invitations/preview", validate("query", inviteTokenQuerySchema), async (c) => {
      noStore(c);
      return c.json(
        await previewInvitation(deps.getDb(c), c.get("user").id, c.req.valid("query").token),
      );
    })
    .post("/requests", validate("json", createFriendRequestSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      const created = await createFriendRequest({
        db: deps.getDb(c),
        requesterUserId: c.get("user").id,
        token: c.req.valid("json").token,
      });
      return c.json(created, 201);
    })
    .post("/requests/:id/accept", validate("param", socialIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await acceptFriendRequest({
          db: deps.getDb(c),
          userId: c.get("user").id,
          requestId: c.req.valid("param").id,
        }),
      );
    })
    .post("/requests/:id/decline", validate("param", socialIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await declineFriendRequest({
          db: deps.getDb(c),
          userId: c.get("user").id,
          requestId: c.req.valid("param").id,
        }),
      );
    })
    .post("/requests/:id/cancel", validate("param", socialIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await cancelFriendRequest({
          db: deps.getDb(c),
          userId: c.get("user").id,
          requestId: c.req.valid("param").id,
        }),
      );
    })
    .get("/blocks", async (c) => {
      noStore(c);
      return c.json(await listBlocks(deps.getDb(c), c.get("user").id));
    })
    .post("/blocks/:userId", validate("param", friendUserIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await blockUser({
          db: deps.getDb(c),
          userId: c.get("user").id,
          peerUserId: c.req.valid("param").userId,
        }),
      );
    })
    .delete("/blocks/:userId", validate("param", friendUserIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await unblockUser({
          db: deps.getDb(c),
          userId: c.get("user").id,
          peerUserId: c.req.valid("param").userId,
        }),
      );
    })
    .delete("/:userId", validate("param", friendUserIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await unfriend({
          db: deps.getDb(c),
          userId: c.get("user").id,
          peerUserId: c.req.valid("param").userId,
        }),
      );
    });
}
