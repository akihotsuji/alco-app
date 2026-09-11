import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CellarDestinationField } from "@/client/components/cellar/CellarDestinationField.tsx";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useInfiniteBottles } from "@/client/hooks/use-bottles.ts";
import {
  useAcceptOwnerTransfer,
  useCancelOwnerTransfer,
  useCellar,
  useCellarActivity,
  useCellarInvitations,
  useCellarMembers,
  useCreateInvitation,
  useCreateOwnerTransfer,
  useCreateSharedCellar,
  useDeleteSharedCellar,
  useLeaveSharedCellar,
  useMoveBottlesToShared,
  useRemoveCellarMember,
  useRevokeInvitation,
  useUpdateCellarName,
} from "@/client/hooks/use-cellars.ts";
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useCellarSync } from "@/client/hooks/use-cellar-sync.ts";
import { useMe } from "@/client/hooks/use-me.ts";
import {
  CELLAR_ACTIVITY_LABELS,
  cellarDisplayName,
  newOperationKey,
  writeSelectedCellarId,
} from "@/client/lib/cellar-share.ts";
import { PREF_CHANGE_EVENT } from "@/client/lib/preferences.ts";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import {
  CELLAR_COPY,
  cellarNameSchema,
  type CellarSummary,
} from "@/shared/cellars.ts";
import {
  CELLAR_DEFAULT_SHARED_NAME,
  CELLAR_NAME_CHIPS,
  CELLAR_NAME_MAX_LENGTH,
  CELLAR_PREF_KEYS,
} from "@/shared/constants.ts";
import { formatShortMonthDay, formatTokyoTime } from "@/shared/tokyo-date.ts";

function useSharedCellarId(searchId?: string | null): string | undefined {
  const { shared } = useCellarSelection();
  return searchId || shared?.id;
}

function selectCellar(id: string) {
  writeSelectedCellarId(id);
  window.dispatchEvent(
    new CustomEvent(PREF_CHANGE_EVENT, { detail: { key: CELLAR_PREF_KEYS.selectedId } }),
  );
}

export function ShareNewPage() {
  const navigate = useNavigate();
  const { shared } = useCellarSelection();
  const create = useCreateSharedCellar();
  const [name, setName] = useState(CELLAR_DEFAULT_SHARED_NAME);
  const parsed = cellarNameSchema.safeParse(name);
  const canSubmit = parsed.success && !create.isPending;

  if (shared) {
    return (
      <div className="form-page">
        <p>すでに共有セラーに参加しています。</p>
        <Link className={buttonVariants()} to="/cellar/share/settings">
          共有設定を開く
        </Link>
      </div>
    );
  }

  return (
    <div className="form-page">
      <p>家族やパートナーと、同じ在庫をそれぞれのアカウントで管理できます。</p>
      <label className="field">
        <span className="field-label">名前</span>
        <Input
          value={name}
          maxLength={CELLAR_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
        />
        {name.trim().length > 0 && !parsed.success ? (
          <p className="field-error" role="alert">
            {parsed.error.issues[0]?.message}
          </p>
        ) : null}
      </label>
      <div className="cellar-name-chips">
        {CELLAR_NAME_CHIPS.map((chip) => (
          <Chip key={chip} selected={name === chip} onSelect={() => setName(chip)}>
            {chip}
          </Chip>
        ))}
      </div>
      <p>{CELLAR_COPY.shareBoundary}</p>
      <SaveBar
        label="共有セラーを作る"
        disabled={!canSubmit}
        pending={create.isPending}
        onSave={() => {
          create.mutate(
            { name: name.trim(), operationKey: newOperationKey() },
            {
              onSuccess: (created) => {
                selectCellar(created.id);
                navigate(`/cellar/share/created?id=${created.id}`, { replace: true });
              },
            },
          );
        }}
      />
    </div>
  );
}

export function ShareCreatedPage() {
  const [params] = useSearchParams();
  const id = params.get("id");
  return (
    <div className="form-page">
      <p>共有セラーを作りました。招待しなくても使えます。</p>
      <Link className={buttonVariants()} to={id ? `/cellar/share/invite?id=${id}` : "/cellar/share/invite"}>
        相手を招待する
      </Link>
      <Link
        className={buttonVariants({ variant: "secondary" })}
        to={id ? `/cellar/share/move?id=${id}` : "/cellar/share/move"}
      >
        自分のボトルを移す
      </Link>
    </div>
  );
}

export function ShareInvitePage() {
  const [params] = useSearchParams();
  const cellarId = useSharedCellarId(params.get("id"));
  const cellar = useCellar(cellarId);
  const create = useCreateInvitation(cellarId ?? "");
  const { showToast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const owner = cellar.data?.role === "owner";

  if (!cellarId) {
    return <p className="form-page">共有セラーがありません。</p>;
  }
  if (cellar.isError) {
    return <QueryError onRetry={() => cellar.refetch()} retrying={cellar.isFetching} />;
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ message: "コピーしました" });
    } catch {
      showToast({ message: "コピーできませんでした" });
    }
  }

  return (
    <div className="form-page">
      <p>{CELLAR_COPY.inviteHint}</p>
      <p>{CELLAR_COPY.inviteTtl}</p>
      {url ? (
        <>
          {canShare ? (
            <Button
              type="button"
              onClick={() => {
                void navigator.share({ url, title: cellar.data?.name ?? "共有セラー" }).catch(() => {
                  // キャンセルはエラーにしない
                });
              }}
            >
              リンクを共有
            </Button>
          ) : null}
          <Button type="button" variant={canShare ? "secondary" : "default"} onClick={() => void copy(url)}>
            コピー
          </Button>
        </>
      ) : null}
      {owner ? (
        <Button
          type="button"
          variant="secondary"
          disabled={create.isPending}
          onClick={() => {
            create.mutate(newOperationKey(), {
              onSuccess: (created) => setUrl(created.url),
            });
          }}
        >
          招待リンクを作る
        </Button>
      ) : (
        <p>招待リンクを作れるのはオーナーだけです。</p>
      )}
    </div>
  );
}

export function ShareSettingsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cellarId = useSharedCellarId(params.get("id"));
  const me = useMe();
  const cellar = useCellar(cellarId);
  const members = useCellarMembers(cellarId);
  const invitations = useCellarInvitations(cellarId, cellar.data?.role === "owner");
  useCellarSync(cellarId);
  const rename = useUpdateCellarName(cellarId ?? "");
  const leave = useLeaveSharedCellar(cellarId ?? "");
  const remove = useRemoveCellarMember(cellarId ?? "");
  const revoke = useRevokeInvitation(cellarId ?? "");
  const transfer = useCreateOwnerTransfer(cellarId ?? "");
  const acceptTransfer = useAcceptOwnerTransfer(cellarId ?? "");
  const cancelTransfer = useCancelOwnerTransfer(cellarId ?? "");
  const destroy = useDeleteSharedCellar(cellarId ?? "");
  const [name, setName] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const owner = cellar.data?.role === "owner";

  useEffect(() => {
    if (cellar.data) {
      setName(cellar.data.name);
    }
  }, [cellar.data]);

  if (!cellarId) {
    return (
      <div className="form-page">
        <p>共有セラーに参加していません。</p>
        <Link className={buttonVariants()} to="/cellar/share">
          セラーを共有する
        </Link>
      </div>
    );
  }
  if (cellar.isPending) {
    return <p className="form-page">読み込み中…</p>;
  }
  if (cellar.isError) {
    return <QueryError onRetry={() => cellar.refetch()} retrying={cellar.isFetching} />;
  }

  const pending = cellar.data.pendingTransfer;
  const iAmTarget = pending?.toUserId === me.data?.id;

  return (
    <div className="form-page cellar-settings">
      <section className="settings-section">
        <h2 className="settings-heading">名称</h2>
        <Input
          value={name}
          maxLength={CELLAR_NAME_MAX_LENGTH}
          readOnly={!owner}
          onChange={(event) => setName(event.target.value)}
        />
        {owner ? (
          <Button
            type="button"
            variant="secondary"
            disabled={rename.isPending || name.trim() === cellar.data.name}
            onClick={() => {
              rename.mutate({ name: name.trim(), operationKey: newOperationKey() });
            }}
          >
            名前を保存
          </Button>
        ) : null}
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">参加者</h2>
        <ul className="cellar-member-list">
          {(members.data?.items ?? []).map((member) => (
            <li key={member.userId ?? member.displayName} className="settings-row">
              <span>
                {member.displayName}
                <span className="settings-value">
                  {member.role === "owner" ? "オーナー" : "メンバー"}
                </span>
              </span>
              {owner && member.role !== "owner" && member.userId ? (
                <button
                  type="button"
                  className="settings-danger-text"
                  onClick={() => setRemoveTarget({ userId: member.userId ?? "", name: member.displayName })}
                >
                  外す
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {owner ? (
        <section className="settings-section">
          <h2 className="settings-heading">招待</h2>
          <Link className="settings-row" to={`/cellar/share/invite?id=${cellarId}`}>
            招待リンクを作る
          </Link>
          <ul className="cellar-invite-list">
            {(invitations.data?.items ?? [])
              .filter((item) => !item.usedAt && !item.revokedAt)
              .map((item) => (
                <li key={item.id} className="settings-row">
                  <span>期限 {formatShortMonthDay(item.expiresAt.slice(0, 10))}</span>
                  <button
                    type="button"
                    onClick={() =>
                      revoke.mutate({ invitationId: item.id, operationKey: newOperationKey() })
                    }
                  >
                    無効にする
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="settings-section">
        <Link className="settings-row" to={`/cellar/share/move?id=${cellarId}`}>
          自分のボトルを移す
        </Link>
        <Link className="settings-row" to={`/cellar/share/activity?id=${cellarId}`}>
          最近の変更
        </Link>
      </section>

      {pending ? (
        <section className="settings-section">
          <h2 className="settings-heading">所有権の移譲</h2>
          <p>申請中です。承諾までは今のオーナーのままです。</p>
          {iAmTarget ? (
            <Button
              type="button"
              onClick={() =>
                acceptTransfer.mutate({ transferId: pending.id, operationKey: newOperationKey() })
              }
            >
              オーナーを引き受ける
            </Button>
          ) : null}
          {owner ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                cancelTransfer.mutate({ transferId: pending.id, operationKey: newOperationKey() })
              }
            >
              申請を取り消す
            </Button>
          ) : null}
        </section>
      ) : owner ? (
        <section className="settings-section">
          <h2 className="settings-heading">所有権の移譲</h2>
          <ul>
            {(members.data?.items ?? [])
              .filter((member) => member.role !== "owner" && member.userId)
              .map((member) => (
                <li key={member.userId}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      transfer.mutate({
                        toUserId: member.userId ?? "",
                        operationKey: newOperationKey(),
                      })
                    }
                  >
                    {member.displayName} に移す
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="settings-section">
        {owner ? (
          <button type="button" className="settings-row settings-logout" onClick={() => setDeleteOpen(true)}>
            共有セラーを削除
          </button>
        ) : (
          <button type="button" className="settings-row" onClick={() => setLeaveOpen(true)}>
            共有セラーから出る
          </button>
        )}
      </section>

      <Dialog
        open={Boolean(removeTarget)}
        title="参加者を外しますか"
        body={`${removeTarget?.name ?? ""} は共有セラーを使えなくなります。この人が追加したボトルは残ります。`}
        primaryLabel="外す"
        destructive
        onPrimary={() => {
          if (!removeTarget) {
            return;
          }
          remove.mutate({ userId: removeTarget.userId, operationKey: newOperationKey() });
          setRemoveTarget(null);
        }}
        onClose={() => setRemoveTarget(null)}
      />
      <Dialog
        open={leaveOpen}
        title="共有セラーから出ますか"
        body={`${CELLAR_COPY.leaveWarning} 共有へ移したボトルは、脱退しても共有セラーに残ります。`}
        primaryLabel="出る"
        onPrimary={() => {
          leave.mutate(newOperationKey(), {
            onSuccess: () => navigate("/cellar", { replace: true }),
          });
        }}
        onClose={() => setLeaveOpen(false)}
      />
      <Dialog
        open={deleteOpen}
        title="共有セラーを削除しますか"
        body={CELLAR_COPY.deleteShared}
        primaryLabel="共有セラーを削除"
        destructive
        pending={destroy.isPending}
        onPrimary={() => {
          destroy.mutate(
            { confirmName: confirmName.trim(), operationKey: newOperationKey() },
            { onSuccess: () => navigate("/cellar", { replace: true }) },
          );
        }}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmName("");
        }}
      >
        <label className="field">
          <span className="field-label">削除するにはセラー名を入力</span>
          <Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} />
        </label>
      </Dialog>
    </div>
  );
}

export function ShareMovePage() {
  const [params] = useSearchParams();
  const cellarId = useSharedCellarId(params.get("id"));
  const { personal, items } = useCellarSelection();
  const move = useMoveBottlesToShared(cellarId ?? "");
  const [view, setView] = useState<"cellar" | "archive">("cellar");
  const [selected, setSelected] = useState<Record<string, { name: string; version: number }>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const list = useInfiniteBottles(
    { view, cellarId: personal?.id, limit: 50 },
    Boolean(personal?.id),
  );
  const bottles = list.data?.pages.flatMap((page) => page.items) ?? [];
  const shared = items.find((item) => item.id === cellarId);
  const count = Object.keys(selected).length;

  if (!cellarId || !personal || !shared) {
    return <p className="form-page">共有セラーがありません。</p>;
  }

  return (
    <div className="form-page">
      <CellarDestinationField items={[shared] as CellarSummary[]} valueId={shared.id} locked />
      <div className="cellar-view-toggle" role="tablist">
        <Chip selected={view === "cellar"} onSelect={() => setView("cellar")}>
          棚
        </Chip>
        <Chip selected={view === "archive"} onSelect={() => setView("archive")}>
          貯蔵庫
        </Chip>
      </div>
      <ul className="cellar-move-list">
        {bottles.map((bottle) => {
          const on = Boolean(selected[bottle.id]);
          return (
            <li key={bottle.id}>
              <label className="cellar-move-row">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    setSelected((current) => {
                      const next = { ...current };
                      if (next[bottle.id]) {
                        delete next[bottle.id];
                      } else {
                        next[bottle.id] = { name: bottle.name, version: bottle.version };
                      }
                      return next;
                    });
                  }}
                />
                {bottle.name}
              </label>
            </li>
          );
        })}
      </ul>
      {list.hasNextPage ? (
        <Button type="button" variant="secondary" onClick={() => void list.fetchNextPage()}>
          さらに表示
        </Button>
      ) : null}
      <SaveBar
        label={count > 0 ? `${count} 本を移す` : "移すボトルを選ぶ"}
        disabled={count === 0 || move.isPending}
        pending={move.isPending}
        onSave={() => setConfirmOpen(true)}
      />
      <Dialog
        open={confirmOpen}
        title={`${shared.name} へ ${count} 本移しますか`}
        body={`${Object.values(selected)
          .map((item) => item.name)
          .join("、")}\n${CELLAR_COPY.moveWarning}`}
        primaryLabel="移す"
        pending={move.isPending}
        onPrimary={() => {
          move.mutate(
            {
              items: Object.entries(selected).map(([bottleId, item]) => ({
                bottleId,
                expectedVersion: item.version,
              })),
              operationKey: newOperationKey(),
            },
            {
              onSuccess: () => {
                selectCellar(shared.id);
                setConfirmOpen(false);
              },
            },
          );
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export function ShareActivityPage() {
  const [params] = useSearchParams();
  const cellarId = useSharedCellarId(params.get("id"));
  const query = useCellarActivity(cellarId);
  useCellarSync(cellarId);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  if (!cellarId) {
    return <p className="form-page">共有セラーがありません。</p>;
  }
  if (query.isError) {
    return <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  return (
    <div className="form-page">
      <ul className="cellar-activity-list">
        {items.map((item) => (
          <li key={item.id} className="settings-row">
            <span>
              {CELLAR_ACTIVITY_LABELS[item.action] ?? item.action}
              {item.bottleName ? ` · ${item.bottleName}` : ""}
              <span className="settings-value">
                {item.actorName} · {formatShortMonthDay(item.createdAt.slice(0, 10))}{" "}
                {formatTokyoTime(new Date(item.createdAt))}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p>最近の変更はありません。</p> : null}
    </div>
  );
}

export function sharedCellarFallbackName(cellar: CellarSummary | undefined): string {
  return cellar ? cellarDisplayName(cellar) : "共有セラー";
}
