import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  acceptInvitationSchema,
  cellarActivityQuerySchema,
  cellarIdParamSchema,
  cellarMemberIdParamSchema,
  createCellarSchema,
  createInvitationSchema,
  createTransferSchema,
  deleteCellarSchema,
  invitationIdParamSchema,
  inviteTokenBodySchema,
  leaveCellarSchema,
  moveBottlesSchema,
  removeMemberSchema,
  transferActionSchema,
  transferIdParamSchema,
  updateCellarSchema,
} from "@/shared/cellars.ts";
import type { AppEnv } from "../app-env.ts";
import { hashRequestBody } from "../services/cellar-crypto.ts";
import {
  acceptInvitation,
  acceptOwnerTransfer,
  cancelOwnerTransfer,
  createInvitation,
  createOwnerTransfer,
  createSharedCellar,
  deleteSharedCellar,
  getCellar,
  getCellarRevision,
  leaveSharedCellar,
  listActivity,
  listCellars,
  listInvitations,
  listMembers,
  moveBottlesToShared,
  previewInvitation,
  removeMember,
  revokeInvitation,
  updateCellarName,
} from "../services/cellars.ts";
import { validate } from "../validation.ts";

export type CellarRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
};

function originOf(c: Context<AppEnv>): string {
  return new URL(c.req.url).origin;
}

export function createCellarsRoute(deps: CellarRouteDeps) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const user = c.get("user");
      return c.json(await listCellars(deps.getDb(c), user.id));
    })
    .post("/", validate("json", createCellarSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const created = await createSharedCellar({
        db: deps.getDb(c),
        userId: user.id,
        body,
        requestHash: await hashRequestBody(body),
      });
      return c.json(created, 201);
    })
    .get("/:id/revision", validate("param", cellarIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      return c.json(await getCellarRevision(deps.getDb(c), user.id, id));
    })
    .get("/:id/members", validate("param", cellarIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      return c.json(await listMembers(deps.getDb(c), user.id, id));
    })
    .post(
      "/:id/leave",
      validate("param", cellarIdParamSchema),
      validate("json", leaveCellarSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        await leaveSharedCellar({
          db: deps.getDb(c),
          userId: user.id,
          cellarId: id,
          operationKey: body.operationKey,
          requestHash: await hashRequestBody({ cellarId: id, ...body }),
        });
        return c.json({ ok: true });
      },
    )
    .delete(
      "/:id/members/:userId",
      validate("param", cellarMemberIdParamSchema),
      validate("json", removeMemberSchema),
      async (c) => {
        const user = c.get("user");
        const { id, userId } = c.req.valid("param");
        const body = c.req.valid("json");
        await removeMember({
          db: deps.getDb(c),
          actorUserId: user.id,
          cellarId: id,
          targetUserId: userId,
          operationKey: body.operationKey,
          requestHash: await hashRequestBody({ cellarId: id, targetUserId: userId, ...body }),
        });
        return c.json({ ok: true });
      },
    )
    .get("/:id/invitations", validate("param", cellarIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      return c.json(await listInvitations(deps.getDb(c), user.id, id));
    })
    .post(
      "/:id/invitations",
      validate("param", cellarIdParamSchema),
      validate("json", createInvitationSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const created = await createInvitation({
          db: deps.getDb(c),
          userId: user.id,
          cellarId: id,
          operationKey: body.operationKey,
          requestHash: await hashRequestBody({ cellarId: id, ...body }),
          origin: originOf(c),
        });
        return c.json(created, 201);
      },
    )
    .post(
      "/:id/invitations/:invitationId/revoke",
      validate("param", invitationIdParamSchema),
      validate("json", createInvitationSchema),
      async (c) => {
        const user = c.get("user");
        const { id, invitationId } = c.req.valid("param");
        const body = c.req.valid("json");
        await revokeInvitation({
          db: deps.getDb(c),
          userId: user.id,
          cellarId: id,
          invitationId,
        });
        void body;
        return c.json({ ok: true });
      },
    )
    .get("/:id/transfers", validate("param", cellarIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const detail = await getCellar(deps.getDb(c), user.id, id);
      return c.json({ item: detail.pendingTransfer });
    })
    .post(
      "/:id/transfers",
      validate("param", cellarIdParamSchema),
      validate("json", createTransferSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const created = await createOwnerTransfer({
          db: deps.getDb(c),
          userId: user.id,
          cellarId: id,
          body,
          requestHash: await hashRequestBody({ cellarId: id, ...body }),
        });
        return c.json(created, 201);
      },
    )
    .post(
      "/:id/transfers/:transferId/cancel",
      validate("param", transferIdParamSchema),
      validate("json", transferActionSchema),
      async (c) => {
        const user = c.get("user");
        const { id, transferId } = c.req.valid("param");
        const body = c.req.valid("json");
        await cancelOwnerTransfer({
          db: deps.getDb(c),
          userId: user.id,
          cellarId: id,
          transferId,
          operationKey: body.operationKey,
          requestHash: await hashRequestBody({ cellarId: id, transferId, action: "cancel", ...body }),
        });
        return c.json({ ok: true });
      },
    )
    .post(
      "/:id/transfers/:transferId/accept",
      validate("param", transferIdParamSchema),
      validate("json", transferActionSchema),
      async (c) => {
        const user = c.get("user");
        const { id, transferId } = c.req.valid("param");
        const body = c.req.valid("json");
        await acceptOwnerTransfer({
          db: deps.getDb(c),
          userId: user.id,
          cellarId: id,
          transferId,
          operationKey: body.operationKey,
          requestHash: await hashRequestBody({ cellarId: id, transferId, action: "accept", ...body }),
        });
        return c.json({ ok: true });
      },
    )
    .get(
      "/:id/activity",
      validate("param", cellarIdParamSchema),
      validate("query", cellarActivityQuerySchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const query = c.req.valid("query");
        return c.json(
          await listActivity({
            db: deps.getDb(c),
            userId: user.id,
            cellarId: id,
            limit: query.limit,
            cursor: query.cursor,
          }),
        );
      },
    )
    .post(
      "/:id/moves",
      validate("param", cellarIdParamSchema),
      validate("json", moveBottlesSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await moveBottlesToShared({
          db: deps.getDb(c),
          userId: user.id,
          sharedCellarId: id,
          body,
          requestHash: await hashRequestBody({ cellarId: id, ...body }),
        });
        return c.json(result, 201);
      },
    )
    .get("/:id", validate("param", cellarIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      return c.json(await getCellar(deps.getDb(c), user.id, id));
    })
    .patch(
      "/:id",
      validate("param", cellarIdParamSchema),
      validate("json", updateCellarSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        return c.json(
          await updateCellarName({
            db: deps.getDb(c),
            userId: user.id,
            cellarId: id,
            body,
            requestHash: await hashRequestBody({ cellarId: id, ...body }),
          }),
        );
      },
    )
    .delete(
      "/:id",
      validate("param", cellarIdParamSchema),
      validate("json", deleteCellarSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        await deleteSharedCellar({
          db: deps.getDb(c),
          userId: user.id,
          cellarId: id,
          body,
          requestHash: await hashRequestBody({ cellarId: id, ...body }),
        });
        return c.json({ ok: true });
      },
    );
}

export function createCellarInvitationsRoute(deps: CellarRouteDeps) {
  return new Hono<AppEnv>()
    .post("/preview", validate("json", inviteTokenBodySchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      return c.json(
        await previewInvitation({
          db: deps.getDb(c),
          userId: user.id,
          token: body.token,
        }),
      );
    })
    .post("/accept", validate("json", acceptInvitationSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const result = await acceptInvitation({
        db: deps.getDb(c),
        userId: user.id,
        body,
        requestHash: await hashRequestBody(body),
      });
      return c.json(result);
    });
}
