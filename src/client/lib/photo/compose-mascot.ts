import { PHOTO_MASCOT_GLOW, PHOTO_MASCOT_STROKE } from "@/shared/constants.ts";
import { computeMascotLayout } from "./geometry.ts";

const BOWL = "M26 22 C26 72 40 98 60 98 C80 98 94 72 94 22 Z";

/** 合成専用。線色は常にライトの #2B261F（spec/character.md 5 章） */
export function surprisedMascotSvg(stroke = PHOTO_MASCOT_STROKE): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">
    <g stroke="${stroke}" stroke-width="4" stroke-linecap="round" fill="none">
      <path d="M18 30 L4 42"/>
      <path d="M16 16 L2 8"/>
      <path d="M28 12 L20 1"/>
    </g>
    <ellipse cx="60" cy="141" rx="30" ry="7" fill="none" stroke="${stroke}" stroke-width="3"/>
    <rect x="57" y="96" width="6" height="40" rx="3" fill="none" stroke="${stroke}" stroke-width="3"/>
    <path d="${BOWL}" fill="#FFFFFF" fill-opacity="0.35"/>
    <clipPath id="bowl"><path d="${BOWL}"/></clipPath>
    <g clip-path="url(#bowl)">
      <path d="M20 66 Q60 50 100 58 V110 H20 Z" fill="#8E2F3C"/>
      <path d="M20 66 Q60 50 100 58 V62 Q60 55 20 70 Z" fill="#B34A5A"/>
    </g>
    <circle cx="90" cy="40" r="2.5" fill="#8E2F3C"/>
    <circle cx="84" cy="32" r="1.8" fill="#8E2F3C"/>
    <path d="${BOWL}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M26 22 H94" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
    <path d="M34 34 C33 50 36 66 42 78" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>
    <circle cx="47" cy="56" r="15" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
    <circle cx="73" cy="53" r="17" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
    <circle cx="42" cy="51" r="4.5" fill="#1F1B17"/>
    <circle cx="67" cy="47" r="5" fill="#1F1B17"/>
    <circle cx="43.5" cy="49.5" r="1.4" fill="#FFFFFF"/>
    <circle cx="68.5" cy="45.5" r="1.6" fill="#FFFFFF"/>
  </svg>`;
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

export async function composeMascot(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const layout = computeMascotLayout(canvas.width, canvas.height);
  const image = await loadSvgImage(surprisedMascotSvg());
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d が使えません");
  }
  ctx.save();
  ctx.fillStyle = PHOTO_MASCOT_GLOW;
  ctx.beginPath();
  ctx.ellipse(
    layout.glowCx,
    layout.glowCy,
    layout.glowRadius,
    layout.glowRadius,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.drawImage(image, layout.x, layout.y, layout.width, layout.height);
  ctx.restore();
  return canvas;
}

export { computeMascotLayout };
