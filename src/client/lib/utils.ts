import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind クラスを結合する。後勝ちの衝突は tailwind-merge が解消する。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
