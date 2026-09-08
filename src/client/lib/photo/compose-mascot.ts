import {
  PHOTO_MASCOT_POSES,
  PHOTO_MASCOT_STROKE,
  type PhotoMascotPose,
} from "@/shared/constants.ts";
import { computeMascotLayout } from "./geometry.ts";

const BOWL = "M26 22 C26 72 40 98 60 98 C80 98 94 72 94 22 Z";
const WINE = "#8E2F3C";
const WINE_LIGHT = "#B34A5A";
const INK = "#1F1B17";

export function pickMascotPose(random = Math.random): PhotoMascotPose {
  const index = Math.floor(random() * PHOTO_MASCOT_POSES.length);
  return PHOTO_MASCOT_POSES[index] ?? "default";
}

/** 合成専用。線色は常にライトの #2B261F（spec/character.md 5 章）。グローは敷かない */
export function mascotSvg(pose: PhotoMascotPose, stroke = PHOTO_MASCOT_STROKE): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">
    ${poseMarkup(pose, stroke)}
  </svg>`;
}

function poseMarkup(pose: PhotoMascotPose, stroke: string): string {
  const stem = `
    <ellipse cx="60" cy="141" rx="30" ry="7" fill="none" stroke="${stroke}" stroke-width="3"/>
    <rect x="57" y="96" width="6" height="40" rx="3" fill="none" stroke="${stroke}" stroke-width="3"/>
  `;
  const bowl = `
    <path d="${BOWL}" fill="#FFFFFF" fill-opacity="0.35"/>
    <clipPath id="bowl"><path d="${BOWL}"/></clipPath>
  `;
  const outline = `
    <path d="${BOWL}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M26 22 H94" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
    <path d="M34 34 C33 50 36 66 42 78" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>
  `;
  switch (pose) {
    case "rest":
      return `
        <g fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M96 22 H106 L96 32 H106"/>
          <path d="M104 6 H111 L104 13 H111"/>
        </g>
        ${stem}${bowl}
        <g clip-path="url(#bowl)">
          <path d="M20 78 Q60 74 100 78 V110 H20 Z" fill="${WINE}"/>
          <path d="M20 78 Q60 74 100 78 V81 Q60 77 20 81 Z" fill="${WINE_LIGHT}"/>
        </g>
        ${outline}
        <circle cx="48" cy="54" r="13" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <circle cx="72" cy="52" r="15" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <path d="M40 57 Q48 63 56 57" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
        <path d="M63 55 Q72 62 81 55" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      `;
    case "cheer":
      return `
        <g fill="${stroke}">
          <path d="M14 40 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z"/>
          <path d="M104 26 l1.5 -4.5 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5 z"/>
        </g>
        ${stem}${bowl}
        <g clip-path="url(#bowl)">
          <path d="M20 62 Q40 48 60 60 Q80 72 100 56 V110 H20 Z" fill="${WINE}"/>
          <path d="M20 62 Q40 48 60 60 Q80 72 100 56 V60 Q80 76 60 64 Q40 52 20 66 Z" fill="${WINE_LIGHT}"/>
        </g>
        ${outline}
        <ellipse cx="48" cy="54" rx="13" ry="11" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <ellipse cx="72" cy="52" rx="15" ry="13" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <circle cx="49" cy="49" r="5.5" fill="${INK}"/>
        <circle cx="73" cy="46" r="6" fill="${INK}"/>
        <circle cx="51" cy="47" r="1.6" fill="#FFFFFF"/>
        <circle cx="75" cy="44" r="1.8" fill="#FFFFFF"/>
      `;
    case "surprised":
      return `
        <g stroke="${stroke}" stroke-width="4" stroke-linecap="round" fill="none">
          <path d="M18 30 L4 42"/>
          <path d="M16 16 L2 8"/>
          <path d="M28 12 L20 1"/>
        </g>
        ${stem}${bowl}
        <g clip-path="url(#bowl)">
          <path d="M20 66 Q60 50 100 58 V110 H20 Z" fill="${WINE}"/>
          <path d="M20 66 Q60 50 100 58 V62 Q60 55 20 70 Z" fill="${WINE_LIGHT}"/>
        </g>
        <circle cx="90" cy="40" r="2.5" fill="${WINE}"/>
        <circle cx="84" cy="32" r="1.8" fill="${WINE}"/>
        ${outline}
        <circle cx="47" cy="56" r="15" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <circle cx="73" cy="53" r="17" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <circle cx="42" cy="51" r="4.5" fill="${INK}"/>
        <circle cx="67" cy="47" r="5" fill="${INK}"/>
        <circle cx="43.5" cy="49.5" r="1.4" fill="#FFFFFF"/>
        <circle cx="68.5" cy="45.5" r="1.6" fill="#FFFFFF"/>
      `;
    default:
      return `
        ${stem}${bowl}
        <g clip-path="url(#bowl)">
          <path d="M20 60 Q60 52 100 60 V110 H20 Z" fill="${WINE}"/>
          <path d="M20 60 Q60 52 100 60 V64 Q60 57 20 64 Z" fill="${WINE_LIGHT}"/>
        </g>
        ${outline}
        <circle cx="48" cy="54" r="13" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <circle cx="72" cy="52" r="15" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
        <circle cx="50" cy="56" r="5.5" fill="${INK}"/>
        <circle cx="74" cy="54" r="6" fill="${INK}"/>
        <circle cx="52" cy="54" r="1.6" fill="#FFFFFF"/>
        <circle cx="76" cy="52" r="1.8" fill="#FFFFFF"/>
      `;
  }
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("mascot svg"));
    };
    image.src = url;
  });
}

export async function composeMascot(
  canvas: HTMLCanvasElement,
  pose: PhotoMascotPose = "surprised",
): Promise<HTMLCanvasElement> {
  const layout = computeMascotLayout(canvas.width, canvas.height);
  const image = await loadSvgImage(mascotSvg(pose));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d が使えません");
  }
  ctx.drawImage(image, layout.x, layout.y, layout.width, layout.height);
  return canvas;
}

export { computeMascotLayout };

/** 既存テスト互換。驚きポーズの SVG */
export function surprisedMascotSvg(stroke = PHOTO_MASCOT_STROKE): string {
  return mascotSvg("surprised", stroke);
}
