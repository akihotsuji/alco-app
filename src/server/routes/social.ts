import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import {
  createSocialShareSchema,
  markNotificationReadSchema,
  putReactionSchema,
  SOCIAL_CONTENT_CACHE_CONTROL,
  SOCIAL_MESSAGES,
  socialAvatarParamSchema,
  socialFeedQuerySchema,
  socialIdParamSchema,
  socialPostPhotoParamSchema,
  socialPreferencesPatchSchema,
  socialProfilePatchSchema,
  socialSourceLookupQuerySchema,
} from "@/shared/social.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError, MALFORMED_REQUEST_MESSAGE } from "../errors.ts";
import { assertSameOrigin } from "../services/origin.ts";
import type { PhotoBucket } from "../services/photos.ts";
import { matchesIfNoneMatch } from "../services/photos.ts";
import { listActiveFriendIds, loadPublicProfile } from "../services/social-access.ts";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "../services/social-notifications.ts";
import {
  createSocialShare,
  getAuthorVisiblePosts,
  getSocialFeed,
  getSocialPost,
  lookupShareSources,
  readSocialPostPhoto,
  unsharePost,
} from "../services/social-posts.ts";
import {
  deleteSocialAvatar,
  getSocialMe,
  getSocialPreferences,
  readAvatarContent,
  updateSocialPreferences,
  updateSocialProfile,
  uploadSocialAvatar,
} from "../services/social-profiles.ts";
import { deleteReaction, listReactionTypes, putReaction } from "../services/social-reactions.ts";
import { validate } from "../validation.ts";

export type SocialRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
};

function noStore(c: Context<AppEnv>) {
  c.header("Cache-Control", SOCIAL_CONTENT_CACHE_CONTROL);
}

export function createSocialRoute(deps: SocialRouteDeps) {
  return new Hono<AppEnv>()
    .get("/me", async (c) => {
      noStore(c);
      return c.json(await getSocialMe(deps.getDb(c), c.get("user").id));
    })
    .patch("/me", validate("json", socialProfilePatchSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await updateSocialProfile(deps.getDb(c), c.get("user").id, c.req.valid("json")),
      );
    })
    .get("/preferences", async (c) => {
      noStore(c);
      return c.json(await getSocialPreferences(deps.getDb(c), c.get("user").id));
    })
    .patch("/preferences", validate("json", socialPreferencesPatchSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await updateSocialPreferences(
          deps.getDb(c),
          c.get("user").id,
          c.req.valid("json").shareDefaultOn,
        ),
      );
    })
    .post("/me/avatar", async (c) => {
      assertSameOrigin(c);
      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        throw new ApiError("validation_error", {
          fields: { "": [MALFORMED_REQUEST_MESSAGE] },
        });
      }
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new ApiError("validation_error", {
          fields: { file: [SOCIAL_MESSAGES.avatar] },
        });
      }
      if (file.size > PHOTO_MAX_BYTES) {
        throw new ApiError("payload_too_large");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      noStore(c);
      return c.json(
        await uploadSocialAvatar({
          db: deps.getDb(c),
          bucket: deps.getBucket(c),
          userId: c.get("user").id,
          bytes,
        }),
      );
    })
    .delete("/me/avatar", async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await deleteSocialAvatar({
          db: deps.getDb(c),
          bucket: deps.getBucket(c),
          userId: c.get("user").id,
        }),
      );
    })
    .get("/avatars/:userId/content", validate("param", socialAvatarParamSchema), async (c) => {
      const content = await readAvatarContent({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        viewerId: c.get("user").id,
        ownerId: c.req.valid("param").userId,
      });
      return c.body(content.body, 200, {
        "Content-Type": content.contentType,
        "Cache-Control": SOCIAL_CONTENT_CACHE_CONTROL,
        "Content-Disposition": "inline",
      });
    })
    .get("/profiles/:id", validate("param", socialIdParamSchema), async (c) => {
      const viewerId = c.get("user").id;
      const { id } = c.req.valid("param");
      if (viewerId !== id) {
        const friends = await listActiveFriendIds(deps.getDb(c), viewerId);
        if (!friends.includes(id)) {
          throw new ApiError("not_found");
        }
      }
      const profile = await loadPublicProfile(deps.getDb(c), id);
      if (!profile) {
        throw new ApiError("not_found");
      }
      noStore(c);
      return c.json(profile);
    })
    .get("/feed", validate("query", socialFeedQuerySchema), async (c) => {
      noStore(c);
      return c.json(await getSocialFeed(deps.getDb(c), c.get("user").id, c.req.valid("query")));
    })
    .get(
      "/profiles/:id/posts",
      validate("param", socialIdParamSchema),
      validate("query", socialFeedQuerySchema),
      async (c) => {
        noStore(c);
        return c.json(
          await getAuthorVisiblePosts(
            deps.getDb(c),
            c.get("user").id,
            c.req.valid("param").id,
            c.req.valid("query"),
          ),
        );
      },
    )
    .get("/sources", validate("query", socialSourceLookupQuerySchema), async (c) => {
      noStore(c);
      return c.json(
        await lookupShareSources(deps.getDb(c), c.get("user").id, c.req.valid("query")),
      );
    })
    .post("/shares", validate("json", createSocialShareSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      const body = c.req.valid("json");
      const result = await createSocialShare({
        db: deps.getDb(c),
        userId: c.get("user").id,
        source: body.source,
        operationKey: body.operationKey,
      });
      return c.json(result, result.created ? 201 : 200);
    })
    .get("/posts/:id", validate("param", socialIdParamSchema), async (c) => {
      noStore(c);
      return c.json(await getSocialPost(deps.getDb(c), c.get("user").id, c.req.valid("param").id));
    })
    .delete("/posts/:id", validate("param", socialIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await unsharePost({
          db: deps.getDb(c),
          userId: c.get("user").id,
          postId: c.req.valid("param").id,
        }),
      );
    })
    .get(
      "/posts/:postId/photos/:photoId/content",
      validate("param", socialPostPhotoParamSchema),
      async (c) => {
        const { postId, photoId } = c.req.valid("param");
        const variant = c.req.query("variant") === "thumb" ? "thumb" : undefined;
        const content = await readSocialPostPhoto({
          db: deps.getDb(c),
          bucket: deps.getBucket(c),
          viewerId: c.get("user").id,
          postId,
          photoId,
          variant,
        });
        if (matchesIfNoneMatch(c.req.header("If-None-Match"), content.etag)) {
          return c.body(null, 304, {
            ETag: content.etag,
            "Cache-Control": SOCIAL_CONTENT_CACHE_CONTROL,
          });
        }
        return c.body(content.body, 200, {
          "Content-Type": content.contentType,
          "Cache-Control": SOCIAL_CONTENT_CACHE_CONTROL,
          "Content-Disposition": "inline",
          ETag: content.etag,
        });
      },
    )
    .get("/reaction-types", async (c) => {
      noStore(c);
      return c.json({ items: await listReactionTypes(deps.getDb(c)) });
    })
    .put(
      "/posts/:id/reaction",
      validate("param", socialIdParamSchema),
      validate("json", putReactionSchema),
      async (c) => {
        assertSameOrigin(c);
        noStore(c);
        return c.json(
          await putReaction({
            db: deps.getDb(c),
            userId: c.get("user").id,
            postId: c.req.valid("param").id,
            reactionTypeId: c.req.valid("json").reactionTypeId,
          }),
        );
      },
    )
    .delete("/posts/:id/reaction", validate("param", socialIdParamSchema), async (c) => {
      assertSameOrigin(c);
      noStore(c);
      return c.json(
        await deleteReaction({
          db: deps.getDb(c),
          userId: c.get("user").id,
          postId: c.req.valid("param").id,
        }),
      );
    })
    .get("/notifications", validate("query", socialFeedQuerySchema), async (c) => {
      noStore(c);
      const query = c.req.valid("query");
      return c.json(
        await listNotifications(deps.getDb(c), c.get("user").id, query.cursor, query.limit),
      );
    })
    .get("/notifications/unread-count", async (c) => {
      noStore(c);
      return c.json({ count: await unreadNotificationCount(deps.getDb(c), c.get("user").id) });
    })
    .post("/notifications/read-all", async (c) => {
      assertSameOrigin(c);
      noStore(c);
      await markAllNotificationsRead(deps.getDb(c), c.get("user").id);
      return c.json({ ok: true as const });
    })
    .patch(
      "/notifications/:id",
      validate("param", socialIdParamSchema),
      validate("json", markNotificationReadSchema),
      async (c) => {
        assertSameOrigin(c);
        noStore(c);
        await markNotificationRead(deps.getDb(c), c.get("user").id, c.req.valid("param").id);
        return c.json({ ok: true as const });
      },
    );
}
