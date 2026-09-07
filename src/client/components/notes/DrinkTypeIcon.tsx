import { Beer, GlassWater, Wine } from "lucide-react";
import type { DrinkType } from "@/shared/constants.ts";

export function DrinkTypeIcon({ type, size = 32 }: { type: DrinkType; size?: number }) {
  if (type === "wine") {
    return <Wine size={size} aria-hidden />;
  }
  if (type === "beer") {
    return <Beer size={size} aria-hidden />;
  }
  return <GlassWater size={size} aria-hidden />;
}
