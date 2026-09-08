import type { DrinkType } from "@/shared/constants.ts";

/** 種類別ボトル型（04-cellar「陳列の写真」。線は --muted） */
export const SILHOUETTE_PATHS: Record<DrinkType, readonly string[]> = {
  wine_red: [
    "M31 8h18v12c15 8 19 22 19 40v48a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10V60c0-18 5-32 19-40V8z",
  ],
  wine_white: [
    "M34 8h12v14c12 8 16 22 16 40v46a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V62c0-18 4-32 16-40V8z",
  ],
  wine_rose: [
    "M33 8h14v13c13 8 17 22 17 40v47a9 9 0 0 1-9 9H27a9 9 0 0 1-9-9V61c0-18 4-32 17-40V8z",
  ],
  wine_sparkling: [
    "M36 4h8v18c16 10 20 24 20 44v42a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8V66c0-20 4-34 20-44V4z",
  ],
  wine_orange: [
    "M30 8h20v11c16 9 20 23 20 41v48a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10V60c0-18 4-32 20-41V8z",
  ],
  wine: [
    "M32 8h16v12c14 8 18 22 18 40v48a10 10 0 0 1-10 10H26a10 10 0 0 1-10-10V60c0-18 4-32 18-40V8z",
  ],
  beer: [
    "M28 16h24v4H28z",
    "M24 20h32a4 4 0 0 1 4 4v74a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V24a4 4 0 0 1 4-4z",
  ],
  whisky: ["M30 8h20v12h16v84a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V20h16V8z"],
  sake: ["M34 6h12v18c16 8 20 22 20 42v42a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V66c0-20 4-34 20-42V6z"],
  shochu: ["M33 6h14v22c10 6 14 16 14 32v48a6 6 0 0 1-6 6H25a6 6 0 0 1-6-6V60c0-16 4-26 14-32V6z"],
  cocktail: ["M16 14h48L40 58 16 14z", "M40 58v38", "M26 102h28"],
  other: ["M30 8h20v10c8 6 12 16 12 28v66a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V46c0-12 4-22 12-28V8z"],
};

type BottleSilhouetteProps = {
  drinkType?: DrinkType;
  className?: string;
};

export function BottleSilhouette({
  drinkType = "other",
  className = "bottle-silhouette",
}: BottleSilhouetteProps) {
  return (
    <svg className={className} viewBox="0 0 80 120" aria-hidden>
      {SILHOUETTE_PATHS[drinkType].map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
