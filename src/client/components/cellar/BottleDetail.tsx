import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { BottleNotesSection } from "@/client/components/cellar/BottleNotesSection.tsx";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { useConsumeBottle, useRestoreBottle } from "@/client/hooks/use-bottles.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { noteCreateHref } from "@/client/lib/app-routes.ts";
import { bottleStatusPill, formatPriceJpy, vintageLabel } from "@/client/lib/bottle-form.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { bottleConsumeState, rememberShelfEvent } from "@/client/lib/history-state.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import type { Bottle } from "@/shared/bottles.ts";
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
  const [lightbox, setLightbox] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [consumeState, setConsumeState] = useState<MotionState>("idle");
  const consume = useConsumeBottle();
  const restore = useRestoreBottle();
  const navigate = useNavigate();
  const { showToast } = useToast();
  useSetHeaderOverride({ title: bottle.name });
  const photo = bottle.photos[0];
  const archived = bottle.status === "consumed";
  const statusPill = bottleStatusPill(bottle);
  const pending = consume.isPending || restore.isPending;
  const summary = [
    DRINK_TYPE_LABELS[bottle.drinkType],
    vintageLabel(bottle.vintage),
    bottle.origin,
  ].filter((value): value is string => Boolean(value));
  const rows: { label: string; value: string }[] = [
    { label: "銘柄名", value: bottle.name },
    { label: "種類", value: DRINK_TYPE_LABELS[bottle.drinkType] },
    { label: "年", value: vintageLabel(bottle.vintage) },
    ...(bottle.origin ? [{ label: "産地", value: bottle.origin }] : []),
    ...(bottle.producer ? [{ label: "生産者", value: bottle.producer }] : []),
    ...(bottle.purchasedOn ? [{ label: "購入日", value: bottle.purchasedOn }] : []),
    ...(bottle.priceJpy !== null
      ? [{ label: "価格", value: formatPriceJpy(bottle.priceJpy) }]
      : []),
    ...(bottle.shop ? [{ label: "購入場所", value: bottle.shop }] : []),
    ...(bottle.storage ? [{ label: "保管場所", value: bottle.storage }] : []),
    ...(bottle.memo ? [{ label: "メモ", value: bottle.memo }] : []),
  ];

  function failureMessage(): string {
    return navigator.onLine ? FORM_ERROR_MESSAGES.generic : FORM_ERROR_MESSAGES.offline;
  }

  function onConsume() {
    if (pending) {
      return;
    }
    setActionError(null);
    setConsumeState("loading");
    consume.mutate(bottle.id, {
      onSuccess: (result) => {
        haptic("success");
        rememberShelfEvent({
          kind: "left",
          bottleId: result.id,
          createdAt: result.createdAt,
          drinkType: result.drinkType,
        });
        navigate("/cellar", {
          state: bottleConsumeState({
            bottleId: result.id,
            createdAt: result.createdAt,
            drinkType: result.drinkType,
          }),
        });
      },
      onError: () => {
        setConsumeState("error");
        setActionError(failureMessage());
      },
    });
  }

  function onRestore() {
    if (pending) {
      return;
    }
    setActionError(null);
    restore.mutate(bottle.id, {
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
    });
  }

  return (
    <div className="bottle-detail skeleton-fade">
      <button
        type="button"
        className={photo?.kind === "cutout" ? "bottle-hero bottle-hero-cutout" : "bottle-hero"}
        onClick={() => {
          if (photo) {
            setLightbox(true);
          }
        }}
        aria-label={photo ? "写真を拡大" : undefined}
        disabled={!photo}
      >
        {photo ? (
          <img
            className={
              photo.kind === "cutout" ? "bottle-hero-img is-cutout" : "bottle-hero-img is-photo"
            }
            src={photoContentUrl(photo.id)}
            alt=""
          />
        ) : (
          <BottleSilhouette drinkType={bottle.drinkType} />
        )}
        <span className="shelf-board bottle-hero-shelf" />
      </button>
      <div className="bottle-status-row">
        {statusPill.consumed ? (
          <span className="bottle-status-pill is-consumed">{statusPill.label}</span>
        ) : (
          <span className="bottle-status-pill">{statusPill.label}</span>
        )}
        <p className="bottle-summary">{summary.join(" ・ ")}</p>
      </div>
      {archived ? (
        <Button asChild>
          <Link to={noteCreateHref(bottle.id)}>ノートを書く</Link>
        </Button>
      ) : (
        <Button
          type="button"
          state={consume.isPending ? "loading" : consumeState}
          disabled={pending}
          onClick={onConsume}
        >
          {consume.isPending ? "開栓中" : "開栓する"}
        </Button>
      )}
      {archived ? (
        <Button type="button" variant="secondary" disabled={pending} onClick={onRestore}>
          セラーに戻す
        </Button>
      ) : null}
      {actionError ? (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <dl className="bottle-props">
        {rows.map((row) => (
          <div className="bottle-prop" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <BottleNotesSection bottleId={bottle.id} notes={notes} totalCount={notesTotalCount} />
      {logs.length > 0 ? (
        <section className="bottle-section">
          <h2 className="bottle-section-title">記録</h2>
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
      {lightbox && photo ? (
        <button
          type="button"
          className="bottle-lightbox"
          onClick={() => setLightbox(false)}
          aria-label="閉じる"
        >
          <img src={photoContentUrl(photo.id)} alt="" />
        </button>
      ) : null}
    </div>
  );
}
