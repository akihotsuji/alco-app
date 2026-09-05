import { useId } from "react";

type MascotPose = "default";

type MascotProps = {
  pose?: MascotPose;
  size: number;
  "aria-hidden"?: boolean;
};

/** 2-06 で 4 ポーズに拡張する。認証画面は default のみ。 */
export function Mascot({ pose: _pose = "default", size, "aria-hidden": ariaHidden }: MascotProps) {
  const clipId = useId();
  const width = (size * 120) / 160;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 160"
      width={width}
      height={size}
      aria-hidden={ariaHidden ?? true}
      role="presentation"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M26 22 C26 72 40 98 60 98 C80 98 94 72 94 22 Z" />
        </clipPath>
      </defs>
      <ellipse cx="60" cy="141" rx="30" ry="7" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect
        x="57"
        y="96"
        width="6"
        height="40"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path d="M26 22 C26 72 40 98 60 98 C80 98 94 72 94 22 Z" fill="#FFFFFF" fillOpacity="0.35" />
      <g clipPath={`url(#${clipId})`}>
        <path d="M20 60 Q60 52 100 60 V110 H20 Z" fill="var(--mascot-wine)" />
        <path d="M20 60 Q60 52 100 60 V64 Q60 57 20 64 Z" fill="var(--mascot-wine-light)" />
      </g>
      <path
        d="M26 22 C26 72 40 98 60 98 C80 98 94 72 94 22 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M26 22 H94" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M34 34 C33 50 36 66 42 78"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="48" cy="54" r="13" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
      <circle cx="72" cy="52" r="15" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="56" r="5.5" fill="var(--mascot-ink)" />
      <circle cx="74" cy="54" r="6" fill="var(--mascot-ink)" />
      <circle cx="52" cy="54" r="1.6" fill="#FFFFFF" />
      <circle cx="76" cy="52" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}
