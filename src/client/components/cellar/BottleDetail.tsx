import { Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { BottleNotesSection } from "@/client/components/cellar/BottleNotesSection.tsx";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { OpenedFollowupSheet } from "@/client/components/cellar/OpenedFollowupSheet.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { DrinkSearchLink } from "@/client/components/form/DrinkSearchLink.tsx";
import {
  ContentPhoto,
  type ContentPhotoState,
  PHOTO_DISPLAY_SIZE,
} from "@/client/components/photo/ContentPhoto.tsx";
import { PhotoViewer } from "@/client/components/photo/PhotoViewer.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import {
  useFinishBottle,
  useOpenBottle,
  useReopenBottle,
  useRestoreBottle,
} from "@/client/hooks/use-bottles.ts";
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useCellarSync } from "@/client/hooks/use-cellar-sync.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { useOpeningSource, useShareIntent } from "@/client/hooks/use-share-intent.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { logCreateHref } from "@/client/lib/app-routes.ts";
import {
  type BottlePropDisplay,
  bottlePropLayout,
  bottleStatusPill,
  displayBottleDate,
  displayBottleMemo,
  displayBottlePrice,
  displayBottleText,
  vintageLabel,
} from "@/client/lib/bottle-form.ts";
import { BOTTLE_PHOTO_ACTION_LABELS } from "@/client/lib/bottle-photo-actions.ts";
import { cellarDisplayName, newOperationKey } from "@/client/lib/cellar-share.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { rememberShelfEvent } from "@/client/lib/history-state.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import {
  markOpenedFollowupDismissed,
  markOpenedFollowupPending,
  shouldShowOpenedFollowup,
} from "@/client/lib/opened-followup.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { BOTTLE_FIELD_LABELS, type BottleItem } from "@/shared/bottles.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";
import { DRINK_TYPE_LABELS } from "@/shared/constants.ts";
import type { DrinkLogItem } from "@/shared/drink-logs.ts";
import type { PhotoMeta } from "@/shared/photos.ts";
import type { TastingNoteListItem } from "@/shared/tasting-notes.ts";
import { formatShortMonthDay, formatTokyoTime } from "@/shared/tokyo-date.ts";

type BottleDetailProps = {
  bottle: BottleItem;
  /**
   * 詳細（`GET /api/bottles/:id`）の写真。`null` は仮表示（performance.md 4b）:
   * 一覧の 1 件で描いていて本データがまだ無い。状態を変える操作は押せない。
   */
  photos: readonly Pick<PhotoMeta, "id" | "kind">[] | null;
  /** 一覧で表示済みのサムネをヒーローの下敷きにする（performance.md 4 章） */
  thumbUnderlay?: boolean;
  logs: readonly DrinkLogItem[];
  notes: readonly TastingNoteListItem[];
  notesTotalCount: number;
};

export function BottleDetail({
  bottle,
  photos,
  thumbUnderlay = false,
  logs,
  notes,
  notesTotalCount,
}: BottleDetailProps) {
  const provisional = photos === null;
  const [lightbox, setLightbox] = useState<"front" | "back" | null>(null);
  const [heroState, setHeroState] = useState<ContentPhotoState>("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [consumeState, setConsumeState] = useState<MotionState>("idle");
  const [followupOpen, setFollowupOpen] = useState(() => shouldShowOpenedFollowup(bottle.id));
  const consume = useOpenBottle();
  const restore = useRestoreBottle();
  const finish = useFinishBottle();
  const reopen = useReopenBottle();
  const share = useShareIntent();
  const opening = useOpeningSource(bottle.id);
  const { items } = useCellarSelection();
  useCellarSync(provisional ? undefined : bottle.cellarId);
  const cellar = items.find((item) => item.id === bottle.cellarId);
  const shared = cellar?.kind === "shared";
  const navigate = useNavigate();
  const { showToast } = useToast();
  // 仮表示の表面は一覧の `thumbPhotoId`（サーバーは `photos[0]` と同じ写真を返す）。裏ラベルは一覧に無い
  const photo = provisional
    ? bottle.thumbPhotoId
      ? { id: bottle.thumbPhotoId, kind: bottle.thumbPhotoKind ?? "photo" }
      : undefined
    : photos[0];
  const backPhoto = provisional ? undefined : photos[1];
  const lightboxPhoto = lightbox === "back" ? backPhoto : lightbox === "front" ? photo : undefined;
  const archived = bottle.status === "consumed";
  const opened = bottle.status === "opened";
  const statusPill = bottleStatusPill(bottle);
  const pending = consume.isPending || restore.isPending || finish.isPending || reopen.isPending;
  // 仮表示の `version` は古いことがある。本データが届くまで状態を変える操作を受け付けない
  const locked = pending || provisional;
  // 押し間違いの救済だけ。記録を付けたあとは取り消させない（bottle-tasting.md 3.2 T10）
  const canUndoOpen = opened && logs.length === 0;
  const vintage = vintageLabel(bottle.vintage);
  const summary = [DRINK_TYPE_LABELS[bottle.drinkType], vintage].filter((value): value is string =>
    Boolean(value),
  );
  type DetailRow = { label: string; display: BottlePropDisplay };
  const bottleInfoRows: DetailRow[] = [
    { label: BOTTLE_FIELD_LABELS.variety, display: displayBottleText(bottle.variety) },
    { label: BOTTLE_FIELD_LABELS.origin, display: displayBottleText(bottle.origin) },
    { label: "生産者", display: displayBottleText(bottle.producer) },
  ];
  const purchaseStorageRows: DetailRow[] = [
    {
      label: BOTTLE_FIELD_LABELS.purchasedOn,
      display: displayBottleDate(bottle.purchasedOn),
    },
    { label: "価格", display: displayBottlePrice(bottle.priceJpy) },
    { label: "購入場所", display: displayBottleText(bottle.shop) },
    {
      label: BOTTLE_FIELD_LABELS.storedOn,
      display: displayBottleDate(bottle.storedOn),
    },
    { label: BOTTLE_FIELD_LABELS.storage, display: displayBottleText(bottle.storage) },
    ...(bottle.updatedByName
      ? [
          {
            label: "最終更新",
            display: {
              text: `${bottle.updatedByName}・${formatTokyoTime(new Date(bottle.updatedAt))}`,
              empty: false,
            } satisfies BottlePropDisplay,
          },
        ]
      : []),
  ];
  const memoDisplay = displayBottleMemo(bottle.memo);

  function failureMessage(): string {
    return navigator.onLine ? FORM_ERROR_MESSAGES.generic : FORM_ERROR_MESSAGES.offline;
  }

  function dismissFollowup(shareOpening = false) {
    markOpenedFollowupDismissed(bottle.id);
    setFollowupOpen(false);
    if (shareOpening && opening.data?.openingEventId) {
      void share.shareIfNeeded({ kind: "opening", openingEventId: opening.data.openingEventId });
    }
  }

  function onConsume() {
    if (locked) {
      return;
    }
    setActionError(null);
    setConsumeState("loading");
    consume.mutate(
      {
        id: bottle.id,
        body: { expectedVersion: bottle.version, operationKey: newOperationKey() },
      },
      {
        onSuccess: (result) => {
          haptic("success");
          rememberShelfEvent({
            kind: "left",
            bottleId: result.id,
            createdAt: result.createdAt,
            drinkType: result.drinkType,
          });
          markOpenedFollowupPending(result.id);
          void opening.refetch();
          setFollowupOpen(true);
          setConsumeState("idle");
        },
        onError: (error) => {
          setConsumeState("error");
          setActionError(
            isApiClientError(error) && error.code === "conflict"
              ? CELLAR_COPY.alreadyConsumed
              : failureMessage(),
          );
        },
      },
    );
  }

  function onRestore() {
    if (locked) {
      return;
    }
    setActionError(null);
    restore.mutate(
      {
        id: bottle.id,
        body: { expectedVersion: bottle.version, operationKey: newOperationKey() },
      },
      {
        onSuccess: (result) => {
          haptic("success");
          rememberShelfEvent({
            kind: "placed",
            bottleId: result.id,
            createdAt: result.createdAt,
            drinkType: result.drinkType,
          });
          showToast({ message: TOAST_MESSAGES.returned, cheer: true });
        },
        onError: () => {
          setActionError(failureMessage());
        },
      },
    );
  }

  function onReopen(target: { id: string; version: number }) {
    if (provisional) {
      return;
    }
    setActionError(null);
    reopen.mutate(
      {
        id: target.id,
        body: { expectedVersion: target.version, operationKey: newOperationKey() },
      },
      {
        onSuccess: () => {
          haptic("success");
          showToast({ message: TOAST_MESSAGES.reopened, cheer: true });
        },
        onError: () => {
          setActionError(failureMessage());
        },
      },
    );
  }

  function onFinish() {
    if (locked) {
      return;
    }
    setActionError(null);
    finish.mutate(
      {
        id: bottle.id,
        body: { expectedVersion: bottle.version, operationKey: newOperationKey() },
      },
      {
        onSuccess: (result) => {
          haptic("success");
          showToast({
            message: TOAST_MESSAGES.finished,
            cheer: true,
            action: { label: "取り消す", onSelect: () => onReopen(result) },
          });
        },
        onError: () => {
          setActionError(failureMessage());
        },
      },
    );
  }

  const heroClass = photo?.kind === "cutout" ? "bottle-hero bottle-hero-cutout" : "bottle-hero";
  const heroImgClass =
    photo?.kind === "cutout" ? "bottle-hero-img is-cutout" : "bottle-hero-img is-photo";
  const heroImage = photo ? (
    <>
      {thumbUnderlay ? (
        // 原本のフェードが終わるまで、同じ枠に一覧サムネを見せる（M-29。写真は動かさない）
        <span
          className="bottle-hero-underlay"
          data-covered={heroState === "loaded" ? "" : undefined}
          aria-hidden
        >
          <ContentPhoto
            className={heroImgClass}
            src={photoContentUrl(photo.id, "thumb")}
            size={PHOTO_DISPLAY_SIZE.bottleHero}
            loading="eager"
          />
        </span>
      ) : null}
      <ContentPhoto
        className={heroImgClass}
        src={photoContentUrl(photo.id)}
        size={PHOTO_DISPLAY_SIZE.bottleHero}
        loading="eager"
        onStateChange={setHeroState}
      />
    </>
  ) : (
    <>
      <BottleSilhouette drinkType={bottle.drinkType} />
      <span className="bottle-hero-empty-label">{BOTTLE_PHOTO_ACTION_LABELS.emptyPhoto}</span>
    </>
  );

  return (
    <div className="bottle-detail skeleton-fade">
      <div className="bottle-detail-identity">
        {cellar ? (
          <p className="bottle-cellar-meta">
            {shared ? <Users size={16} aria-hidden /> : null}
            {cellarDisplayName(cellar)}
          </p>
        ) : null}
        <div className="bottle-detail-heading">
          <h2 className="bottle-detail-name">{bottle.name}</h2>
          <DrinkSearchLink
            name={bottle.name}
            producer={bottle.producer}
            vintage={bottle.vintage}
            drinkType={bottle.drinkType}
          />
        </div>
        <div className="bottle-status-row">
          {summary.length > 0 ? <p className="bottle-summary">{summary.join(" ・ ")}</p> : null}
          <span className={statusPill.consumed ? "bottle-status is-consumed" : "bottle-status"}>
            {statusPill.label}
          </span>
        </div>
        {statusPill.detail ? <p className="bottle-status-detail">{statusPill.detail}</p> : null}
      </div>
      <div className={backPhoto ? "bottle-detail-photos has-back" : "bottle-detail-photos"}>
        {photo ? (
          <button
            type="button"
            className={heroClass}
            onClick={() => setLightbox("front")}
            aria-label={BOTTLE_PHOTO_ACTION_LABELS.expandFront}
          >
            {heroImage}
          </button>
        ) : (
          <div className={heroClass}>{heroImage}</div>
        )}
        {backPhoto ? (
          <button
            type="button"
            className="bottle-back-thumb"
            onClick={() => setLightbox("back")}
            aria-label={BOTTLE_PHOTO_ACTION_LABELS.expandBack}
          >
            <span className="photo-thumb bottle-back-thumb-frame">
              <ContentPhoto
                className="photo-thumb-img"
                src={photoContentUrl(backPhoto.id, "thumb")}
                size={PHOTO_DISPLAY_SIZE.bottleTile}
                loading="lazy"
              />
            </span>
            <span className="bottle-back-thumb-label">
              {BOTTLE_PHOTO_ACTION_LABELS.backHeading}
            </span>
          </button>
        ) : null}
      </div>
      <section className="bottle-basics">
        <div className="bottle-props-group">
          <h3 className="bottle-basics-title">ボトル情報</h3>
          <dl className="bottle-props">
            {bottleInfoRows.map((row) => (
              <div className={`bottle-prop is-${bottlePropLayout(row.label)}`} key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.display.empty ? "is-empty" : undefined}>{row.display.text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bottle-props-group">
          <h3 className="bottle-basics-title">購入・保管</h3>
          <dl className="bottle-props">
            {purchaseStorageRows.map((row) => (
              <div className={`bottle-prop is-${bottlePropLayout(row.label)}`} key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.display.empty ? "is-empty" : undefined}>{row.display.text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bottle-memo">
          <h3 className="bottle-basics-title">
            メモ
            {shared ? <span className="bottle-memo-share">参加者に共有</span> : null}
          </h3>
          <p className={memoDisplay.empty ? "bottle-memo-body is-empty" : "bottle-memo-body"}>
            {memoDisplay.text}
          </p>
        </div>
      </section>
      <BottleNotesSection
        bottleId={bottle.id}
        notes={notes}
        totalCount={notesTotalCount}
        shared={shared}
      />
      {logs.length > 0 ? (
        <section className="bottle-section">
          <h2 className="bottle-section-title">{shared ? "自分の飲酒記録" : "記録"}</h2>
          <ul className="bottle-log-list">
            {logs.map((log) => (
              <li key={log.id}>
                <Link className="bottle-log-row" to={`/logs/entries/${log.id}/edit`}>
                  <span>
                    {formatShortMonthDay(log.drunkOn)} {formatTokyoTime(new Date(log.drunkAt))}
                  </span>
                  <span>{log.volumeMl}ml</span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="bottle-detail-actions">
        {opened ? (
          <div className="bottle-detail-action-pair">
            {provisional ? (
              <Button type="button" disabled>
                飲んだ量を記録
              </Button>
            ) : (
              <Link
                className={buttonVariants()}
                to={logCreateHref({ bottleId: bottle.id, from: "detail" })}
              >
                飲んだ量を記録
              </Link>
            )}
            <Button type="button" variant="secondary" disabled={locked} onClick={onFinish}>
              {finish.isPending ? "更新中…" : "飲み切った"}
            </Button>
          </div>
        ) : archived ? (
          <div className="bottle-detail-action-pair">
            {provisional ? (
              <Button type="button" variant="secondary" disabled>
                飲んだ量を記録
              </Button>
            ) : (
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to={logCreateHref({ bottleId: bottle.id, from: "detail" })}
              >
                飲んだ量を記録
              </Link>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={locked}
              onClick={() => onReopen(bottle)}
            >
              {reopen.isPending ? "更新中…" : "味わい中に戻す"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            state={consume.isPending ? "loading" : consumeState}
            disabled={locked}
            onClick={onConsume}
          >
            {consume.isPending ? "更新中…" : "開栓する"}
          </Button>
        )}
        {canUndoOpen && !provisional ? (
          <button
            type="button"
            className="header-text-link bottle-undo-open"
            disabled={locked}
            onClick={onRestore}
          >
            {restore.isPending ? "更新中…" : "開栓を取り消す"}
          </button>
        ) : null}
        {actionError ? (
          <p className="field-error" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
      <PhotoViewer
        open={lightbox !== null && Boolean(lightboxPhoto)}
        src={lightboxPhoto ? photoContentUrl(lightboxPhoto.id) : ""}
        alt={lightbox === "back" ? `${bottle.name}（裏ラベル）` : bottle.name}
        checkerboard={lightboxPhoto?.kind === "cutout"}
        onClose={() => setLightbox(null)}
      />
      <OpenedFollowupSheet
        open={followupOpen && !provisional}
        onClose={dismissFollowup}
        shared={shared}
        canShare={share.canShare}
        shareOn={share.shareOn}
        onShareOnChange={share.setShareOn}
        onLog={() => {
          dismissFollowup(false);
          navigate(
            logCreateHref({
              bottleId: bottle.id,
              from: "opened",
              openingEventId: opening.data?.openingEventId,
            }),
          );
        }}
      />
    </div>
  );
}
