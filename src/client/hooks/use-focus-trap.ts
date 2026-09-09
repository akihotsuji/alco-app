import { type RefObject, useEffect } from "react";

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type QueryRoot = {
  querySelectorAll: (selector: string) => NodeListOf<HTMLElement>;
};

export function focusableElements(root: QueryRoot): HTMLElement[] {
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true",
  );
}

/** Tab / Shift+Tab で循環する次の添字。要素が無ければ -1 */
export function nextFocusIndex(current: number, count: number, shift: boolean): number {
  if (count === 0) {
    return -1;
  }
  if (shift) {
    return current <= 0 ? count - 1 : current - 1;
  }
  return current >= count - 1 ? 0 : current + 1;
}

/**
 * 自作モーダル用。Radix Dialog がある画面は使わない。
 * 開いたら先頭へフォーカスし、閉じたら開く前の要素へ戻す。
 */
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = focusableElements(container as QueryRoot)[0];
    initial?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") {
        return;
      }
      const items = focusableElements(container as QueryRoot);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = nextFocusIndex(current, items.length, event.shiftKey);
      const target = items[next];
      if (target && (current === -1 || next !== current)) {
        event.preventDefault();
        target.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [active, containerRef]);
}
