import { useId } from "react";

export const MASCOT_POSES = ["default", "surprised", "rest", "cheer"] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

type MascotProps = {
  pose?: MascotPose;
  size: number;
  "aria-hidden"?: boolean;
};

const BOWL = "M26 22 C26 72 40 98 60 98 C80 98 94 72 94 22 Z";

function Wine({ dFill, dHighlight }: { dFill: string; dHighlight: string }) {
  return (
    <>
      <path d={dFill} fill="var(--mascot-wine)" />
      <path d={dHighlight} fill="var(--mascot-wine-light)" />
    </>
  );
}

function BowlOutline() {
  return (
    <>
      <path d={BOWL} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M26 22 H94" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M34 34 C33 50 36 66 42 78"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  );
}

function PoseContent({ pose, clipId }: { pose: MascotPose; clipId: string }) {
  switch (pose) {
    case "rest":
      return (
        <>
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M96 22 H106 L96 32 H106" />
            <path d="M104 6 H111 L104 13 H111" />
          </g>
          <GlassStem />
          <path d={BOWL} fill="#FFFFFF" fillOpacity="0.35" />
          <g clipPath={`url(#${clipId})`}>
            <Wine
              dFill="M20 78 Q60 74 100 78 V110 H20 Z"
              dHighlight="M20 78 Q60 74 100 78 V81 Q60 77 20 81 Z"
            />
          </g>
          <BowlOutline />
          <circle cx="48" cy="54" r="13" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
          <circle cx="72" cy="52" r="15" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
          <path
            d="M40 57 Q48 63 56 57"
            fill="none"
            stroke="var(--mascot-ink)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M63 55 Q72 62 81 55"
            fill="none"
            stroke="var(--mascot-ink)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "cheer":
      return (
        <>
          <g fill="currentColor">
            <path d="M14 40 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z" />
            <path d="M104 26 l1.5 -4.5 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5 z" />
          </g>
          <GlassStem />
          <path d={BOWL} fill="#FFFFFF" fillOpacity="0.35" />
          <g clipPath={`url(#${clipId})`}>
            <Wine
              dFill="M20 62 Q40 48 60 60 Q80 72 100 56 V110 H20 Z"
              dHighlight="M20 62 Q40 48 60 60 Q80 72 100 56 V60 Q80 76 60 64 Q40 52 20 66 Z"
            />
          </g>
          <BowlOutline />
          <ellipse
            cx="48"
            cy="54"
            rx="13"
            ry="11"
            fill="#FFFFFF"
            stroke="currentColor"
            strokeWidth="3"
          />
          <ellipse
            cx="72"
            cy="52"
            rx="15"
            ry="13"
            fill="#FFFFFF"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="49" cy="49" r="5.5" fill="var(--mascot-ink)" />
          <circle cx="73" cy="46" r="6" fill="var(--mascot-ink)" />
          <circle cx="51" cy="47" r="1.6" fill="#FFFFFF" />
          <circle cx="75" cy="44" r="1.8" fill="#FFFFFF" />
        </>
      );
    case "surprised":
      return (
        <>
          <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M18 30 L4 42" />
            <path d="M16 16 L2 8" />
            <path d="M28 12 L20 1" />
          </g>
          <GlassStem />
          <path d={BOWL} fill="#FFFFFF" fillOpacity="0.35" />
          <g clipPath={`url(#${clipId})`}>
            <Wine
              dFill="M20 66 Q60 50 100 58 V110 H20 Z"
              dHighlight="M20 66 Q60 50 100 58 V62 Q60 55 20 70 Z"
            />
          </g>
          <circle cx="90" cy="40" r="2.5" fill="var(--mascot-wine)" />
          <circle cx="84" cy="32" r="1.8" fill="var(--mascot-wine)" />
          <BowlOutline />
          <circle cx="47" cy="56" r="15" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
          <circle cx="73" cy="53" r="17" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
          <circle cx="42" cy="51" r="4.5" fill="var(--mascot-ink)" />
          <circle cx="67" cy="47" r="5" fill="var(--mascot-ink)" />
          <circle cx="43.5" cy="49.5" r="1.4" fill="#FFFFFF" />
          <circle cx="68.5" cy="45.5" r="1.6" fill="#FFFFFF" />
        </>
      );
    default:
      return (
        <>
          <GlassStem />
          <path d={BOWL} fill="#FFFFFF" fillOpacity="0.35" />
          <g clipPath={`url(#${clipId})`}>
            <Wine
              dFill="M20 60 Q60 52 100 60 V110 H20 Z"
              dHighlight="M20 60 Q60 52 100 60 V64 Q60 57 20 64 Z"
            />
          </g>
          <BowlOutline />
          <circle cx="48" cy="54" r="13" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
          <circle cx="72" cy="52" r="15" fill="#FFFFFF" stroke="currentColor" strokeWidth="3" />
          <circle cx="50" cy="56" r="5.5" fill="var(--mascot-ink)" />
          <circle cx="74" cy="54" r="6" fill="var(--mascot-ink)" />
          <circle cx="52" cy="54" r="1.6" fill="#FFFFFF" />
          <circle cx="76" cy="52" r="1.8" fill="#FFFFFF" />
        </>
      );
  }
}

function GlassStem() {
  return (
    <>
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
    </>
  );
}

export function Mascot({ pose = "default", size, "aria-hidden": ariaHidden }: MascotProps) {
  const clipId = useId();
  const width = (size * 120) / 160;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 160"
      width={width}
      height={size}
      className="text-foreground"
      aria-hidden={ariaHidden ?? true}
      role="presentation"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BOWL} />
        </clipPath>
      </defs>
      <PoseContent pose={pose} clipId={clipId} />
    </svg>
  );
}
