import { type RefObject, useEffect, useRef } from "react";

type LoadMoreSentinelProps = {
  enabled: boolean;
  onVisible: () => void;
  root?: RefObject<Element | null>;
  className?: string;
};

export function LoadMoreSentinel({
  enabled,
  onVisible,
  root,
  className = "cellar-load-sentinel",
}: LoadMoreSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onVisible();
        }
      },
      root ? { root: root.current, rootMargin: "0px 80px 0px 0px" } : undefined,
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onVisible, root]);

  return <div ref={ref} className={className} />;
}
