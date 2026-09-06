import { useEffect, useState } from "react";
import {
  SHELF_COLUMNS_NARROW,
  SHELF_COLUMNS_WIDE,
  SHELF_WIDE_MIN_PX,
  shelfColumns,
} from "@/client/lib/cellar-shelf.ts";

export function useShelfColumns(): number {
  const [columns, setColumns] = useState(() =>
    typeof window === "undefined" ? SHELF_COLUMNS_NARROW : shelfColumns(window.innerWidth),
  );

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${SHELF_WIDE_MIN_PX}px)`);
    const sync = () => setColumns(media.matches ? SHELF_COLUMNS_WIDE : SHELF_COLUMNS_NARROW);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return columns;
}
