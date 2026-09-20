import { Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { BottleNotesSection } from "@/client/components/cellar/BottleNotesSection.tsx";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { OpenedFollowupSheet } from "@/client/components/cellar/OpenedFollowupSheet.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { DrinkSearchLink } from "@/client/components/form/DrinkSearchLink.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { PhotoViewer } from "@/client/components/photo/PhotoViewer.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { useConsumeBottle, useRestoreBottle } from "@/client/hooks/use-bottles.ts";
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useCellarSync } from "@/client/hooks/use-cellar-sync.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { useOpeningSource, useShareIntent } from "@/client/hooks/use-share-intent.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { logCreateHref } from "@/client/lib/app-routes.ts";
import {
  bottlePropLayout,
  bottleStatusPill,
  formatBottleDisplayDate,
  formatPriceJpy,
  UNKNOWN_PROP_VALUE,
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
import { BOTTLE_FIELD_LABELS, type Bottle } from "@/shared/bottles.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";
import { DRINK_TYPE_LABELS } from "@/shared/constants.ts";
import type { DrinkLogItem } from "@/shared/drink-logs.ts";
import type { TastingNoteListItem } from "@/shared/tasting-notes.ts";
import { formatShortMonthDay, formatTokyoTime } from "@/shared/tokyo-date.ts";

type BottleDetailProps = {
  bottle: Bottle;
  logs: readonly DrinkLogItem[];
  notes: readonly TastingNoteListItem[];
  notesTotalCount: number;
};

export function BottleDetail({ bottle, logs, notes, notesTotalCount }: BottleDetailProps) {
  const [lightbox, setLightbox] = useState<"front" | "back" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [consumeState, setConsumeState] = useState<MotionState>("idle");
  const [followupOpen, setFollowupOpen] = useState(() => shouldShowOpenedFollowup(bottle.id));
  const consume = useConsumeBottle();
  const restore = useRestoreBottle();
  const share = useShareIntent();
  const opening = useOpeningSource(bottle.id);
  const { items } = useCellarSelection();
  useCellarSync(bottle.cellarId);
  const cellar = items.find((item) => item.id === bottle.cellarId);
  const shared = cellar?.kind === "shared";
  const navigate = useNavigate();
  const { showToast } = useToast();
  const photo = bottle.photos[0];
  const backPhoto = bottle.photos[1];
  const lightboxPhoto = lightbox === "back" ? backPhoto : lightbox === "front" ? photo : undefined;
  const archived = bottle.status === "consumed";
  const statusPill = bottleStatusPill(bottle);
  const pending = consume.isPending || restore.isPending;
  const vintage = vintageLabel(bottle.vintage);
  const summary = [DRINK_TYPE_LABELS[bottle.drinkType], vintage].filter((value): value is string =>
    Boolean(value),
  );
  const rows: { label: string; value: string }[] = [
    { label: BOTTLE_FIELD_LABELS.variety, value: bottle.variety || UNKNOWN_PROP_VALUE },
    { label: BOTTLE_FIELD_LABELS.origin, value: bottle.origin || UNKNOWN_PROP_VALUE },
    { label: "生産者", value: bottle.producer || UNKNOWN_PROP_VALUE },
    {
      label: BOTTLE_FIELD_LABELS.purchasedOn,
      value: bottle.purchasedOn ? formatBottleDisplayDate(bottle.purchasedOn) : UNKNOWN_PROP_VALUE,
    },
    {
      label: "価格",
      value: bottle.priceJpy !== null ? formatPriceJpy(bottle.priceJpy) : UNKNOWN_PROP_VALUE,
    },
    { label: "購入場所", value: bottle.shop || UNKNOWN_PROP_VALUE },
    {
      label: BOTTLE_FIELD_LABELS.storedOn,
      value: bottle.storedOn ? formatBottleDisplayDate(bottle.storedOn) : UNKNOWN_PROP_VALUE,
    },
    { label: BOTTLE_FIELD_LABELS.storage, value: bottle.storage || UNKNOWN_PROP_VALUE },
    ...(bottle.updatedByName
      ? [
          {
            label: "最終更新",
            value: `${bottle.updatedByName}・${formatTokyoTime(new Date(bottle.updatedAt))}`,
          },
        ]
      : []),
    {
      label: shared ? CELLAR_COPY.sharedMemoLabel : "メモ",
      value: bottle.memo || UNKNOWN_PROP_VALUE,
    },
  ];

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
    if (pending) {
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
    if (pending) {
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

  const heroClass = photo?.kind === "cutout" ? "bottle-hero bottle-hero-cutout" : "bottle-hero";
  const heroImage = photo ? (
    <ContentPhoto
      className={photo.kind === "cutout" ? "bottle-hero-img is-cutout" : "bottle-hero-img is-photo"}
      src={photoContentUrl(photo.id)}
      size={PHOTO_DISPLAY_SIZE.bottleHero}
      loading="eager"
    />
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
          <div className={heroClass}>
            {heroImage}
          </div>
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
                src={photoContentUrl(backPhoto.id)}
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
        <h3 className="bottle-basics-title">基本情報</h3>
        <dl className="bottle-props">
          {rows.map((row) => (
            <div className={`bottle-prop is-${bottlePropLayout(row.label)}`} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
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
        {archived ? (
          <div className="bottle-followup-actions">
            <Link
              className="bottle-followup-row"
              to={logCreateHref({ bottleId: bottle.id, from: "detail" })}
            >
              飲んだ量を記録
            </Link>
          </div>
        ) : (
          <Button
            type="button"
            state={consume.isPending ? "loading" : consumeState}
            disabled={pending}
            onClick={onConsume}
          >
            {consume.isPending ? "更新中…" : "開栓する"}
          </Button>
        )}
        {archived ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={onRestore}>
            {restore.isPending ? "更新中…" : "開栓の記録を取り消す"}
          </Button>
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
        open={followupOpen}
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
