import { useState } from "react";
import { Link } from "react-router";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { formatPriceJpy, vintageLabel } from "@/client/lib/bottle-form.ts";
import type { Bottle } from "@/shared/bottles.ts";
import { DRINK_TYPE_LABELS } from "@/shared/constants.ts";
import type { DrinkLogItem } from "@/shared/drink-logs.ts";
import { formatShortMonthDay, formatTokyoTime } from "@/shared/tokyo-date.ts";

type BottleDetailProps = {
  bottle: Bottle;
  logs: readonly DrinkLogItem[];
};

export function BottleDetail({ bottle, logs }: BottleDetailProps) {
  const [lightbox, setLightbox] = useState(false);
  useSetHeaderOverride({ title: bottle.name });
  const photo = bottle.photos[0];
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
          <BottleSilhouette />
        )}
        <span className="shelf-board bottle-hero-shelf" />
      </button>
      <div className="bottle-status-row">
        {bottle.status === "consumed" && bottle.consumedOn ? (
          <span className="bottle-status-pill is-consumed">
            開栓（{formatShortMonthDay(bottle.consumedOn)}）
          </span>
        ) : (
          <span className="bottle-status-pill">未開栓</span>
        )}
        <p className="bottle-summary">{summary.join(" ・ ")}</p>
      </div>
      <dl className="bottle-props">
        {rows.map((row) => (
          <div className="bottle-prop" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
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

function BottleSilhouette() {
  return (
    <svg className="bottle-silhouette" viewBox="0 0 80 120" aria-hidden>
      <path
        d="M30 8h20v10c8 6 12 16 12 28v66a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V46c0-12 4-22 12-28V8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}
