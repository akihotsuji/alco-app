import { type RefObject, useEffect } from "react";
import { listScrollKey, readListScroll, writeListScroll } from "@/client/lib/list-scroll.ts";

/** セラー／ノート一覧の `.app-content` スクロールを、詳細から戻ったときに戻す */
export function useListScrollRestore(
  contentRef: RefObject<HTMLDivElement | null>,
  pathname: string,
  search: string,
): void {
  const key = listScrollKey(pathname, search);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const saved = readListScroll(key);
    if (saved !== null) {
      el.scrollTop = saved;
    }
    function persist() {
      const node = contentRef.current;
      if (!node) {
        return;
      }
      writeListScroll(key, node.scrollTop);
    }
    el.addEventListener("scroll", persist, { passive: true });
    return () => {
      persist();
      el.removeEventListener("scroll", persist);
    };
  }, [contentRef, key]);
}
