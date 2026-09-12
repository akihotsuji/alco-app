import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { BottleNotesSection } from "@/client/components/cellar/BottleNotesSection.tsx";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { OpenedFollowupSheet } from "@/client/components/cellar/OpenedFollowupSheet.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { PhotoViewer } from "@/client/components/photo/PhotoViewer.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { useConsumeBottle, useRestoreBottle } from "@/client/hooks/use-bottles.ts";
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useCellarSync } from "@/client/hooks/use-cellar-sync.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { logCreateHref, noteCreateHref } from "@/client/lib/app-routes.ts";
import {
  bottlePropLayout,
  bottleStatusPill,
  formatBottleDisplayDate,
  formatPriceJpy,
  vintageLabel,
} from "@/client/lib/bottle-form.ts";
import { newOperationKey } from "@/client/lib/cellar-share.ts";
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
  const { items } = useCellarSelection();
  useCellarSync(bottle.cellarId);
  const shared = items.find((item) => item.id === bottle.cellarId)?.kind === "shared";
  const navigate = useNavigate();
  const { showToast } = useToast();
  useSetHeaderOverride({ title: bottle.name });
  const photo = bottle.photos[0];
  const backPhoto = bottle.photos[1];
  const lightboxPhoto = lightbox === "back" ? backPhoto : lightbox === "front" ? photo : undefined;
  const archived = bottle.status === "consumed";
  const statusPill = bottleStatusPill(bottle);
  const pending = consume.isPending || restore.isPending;
  const vintage = vintageLabel(bottle.vintage);
  const summary = [
    DRINK_TYPE_LABELS[bottle.drinkType],
    vintage,
    bottle.variety,
    bottle.origin,
  ].filter((value): value is string => Boolean(value));
  const rows: { label: string; value: string }[] = [
    { label: BOTTLE_FIELD_LABELS.name, value: bottle.name },
    { label: "種類", value: DRINK_TYPE_LABELS[bottle.drinkType] },
    ...(vintage ? [{ label: BOTTLE_FIELD_LABELS.vintage, value: vintage }] : []),
    ...(bottle.variety ? [{ label: BOTTLE_FIELD_LABELS.variety, value: bottle.variety }] : []),
    ...(bottle.origin ? [{ label: BOTTLE_FIELD_LABELS.origin, value: bottle.origin }] : []),
    ...(bottle.producer ? [{ label: "生産者", value: bottle.producer }] : []),
    ...(bottle.purchasedOn
      ? [
          {
            label: BOTTLE_FIELD_LABELS.purchasedOn,
            value: formatBottleDisplayDate(bottle.purchasedOn),
          },
        ]
      : []),
    ...(bottle.priceJpy !== null
      ? [{ label: "価格", value: formatPriceJpy(bottle.priceJpy) }]
      : []),
    ...(bottle.shop ? [{ label: "購入場所", value: bottle.shop }] : []),
    ...(bottle.storedOn
      ? [{ label: BOTTLE_FIELD_LABELS.storedOn, value: formatBottleDisplayDate(bottle.storedOn) }]
      : []),
    ...(bottle.storage ? [{ label: BOTTLE_FIELD_LABELS.storage, value: bottle.storage }] : []),
    ...(bottle.updatedByName
      ? [
          {
            label: "最終更新",
            value: `${bottle.updatedByName}・${formatTokyoTime(new Date(bottle.updatedAt))}`,
          },
        ]
      : []),
    ...(bottle.memo
      ? [{ label: shared ? CELLAR_COPY.sharedMemoLabel : "メモ", value: bottle.memo }]
      : []),
  ];

  function failureMessage(): string {
    return navigator.onLine ? FORM_ERROR_MESSAGES.generic : FORM_ERROR_MESSAGES.offline;
  }

  function dismissFollowup() {
    markOpenedFollowupDismissed(bottle.id);
    setFollowupOpen(false);
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

  return (
    <div className="bottle-detail skeleton-fade">
      <button
        type="button"
        className={photo?.kind === "cutout" ? "bottle-hero bottle-hero-cutout" : "bottle-hero"}
        onClick={() => {
          if (photo) {
            setLightbox("front");
          }
        }}
        aria-label={photo ? "写真を拡大" : undefined}
        disabled={!photo}
      >
        {photo ? (
          <ContentPhoto
            className={
              photo.kind === "cutout" ? "bottle-hero-img is-cutout" : "bottle-hero-img is-photo"
            }
            src={photoContentUrl(photo.id)}
            size={
              photo.kind === "cutout"
                ? PHOTO_DISPLAY_SIZE.bottleHero
                : PHOTO_DISPLAY_SIZE.bottleHeroPhoto
            }
            loading="eager"
          />
        ) : (
          <BottleSilhouette drinkType={bottle.drinkType} />
        )}
        <span className="shelf-board bottle-hero-shelf" />
      </button>
      {backPhoto ? (
        <button
          type="button"
          className="bottle-back-thumb"
          onClick={() => setLightbox("back")}
          aria-label="裏面の写真を拡大"
        >
          <span className="photo-thumb bottle-back-thumb-frame">
            <ContentPhoto
              className="photo-thumb-img"
              src={photoContentUrl(backPhoto.id)}
              size={PHOTO_DISPLAY_SIZE.bottleTile}
              loading="lazy"
            />
          </span>
          <span className="bottle-back-thumb-label">裏面</span>
        </button>
      ) : null}
      <div className="bottle-status-row">
        {statusPill.consumed ? (
          <span className="bottle-status-pill is-consumed">{statusPill.label}</span>
        ) : (
          <span className="bottle-status-pill">{statusPill.label}</span>
        )}
        <p className="bottle-summary">{summary.join(" ・ ")}</p>
      </div>
      {archived ? (
        <div className="bottle-followup-actions">
          <Link
            className="bottle-followup-row"
            to={logCreateHref({ bottleId: bottle.id, from: "detail" })}
          >
            飲んだ量を記録
          </Link>
          <Link className="bottle-followup-row" to={noteCreateHref(bottle.id, "detail")}>
            テイスティングノートを書く
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
      <dl className="bottle-props">
        {rows.map((row) => (
          <div className={`bottle-prop is-${bottlePropLayout(row.label)}`} key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
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
      <PhotoViewer
        open={lightbox !== null && Boolean(lightboxPhoto)}
        src={lightboxPhoto ? photoContentUrl(lightboxPhoto.id) : ""}
        alt={lightbox === "back" ? `${bottle.name}（裏面）` : bottle.name}
        checkerboard={lightboxPhoto?.kind === "cutout"}
        onClose={() => setLightbox(null)}
      />
      <OpenedFollowupSheet
        open={followupOpen}
        onClose={dismissFollowup}
        shared={shared}
        onLog={() => {
          dismissFollowup();
          navigate(logCreateHref({ bottleId: bottle.id, from: "opened" }));
        }}
        onNote={() => {
          dismissFollowup();
          navigate(noteCreateHref(bottle.id, "opened"));
        }}
      />
    </div>
  );
}
