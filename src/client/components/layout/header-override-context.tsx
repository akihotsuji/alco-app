import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type HeaderOverride = {
  title?: string;
  titleMuted?: string;
};

type HeaderOverrideValue = {
  override: HeaderOverride;
  setOverride: (next: HeaderOverride) => void;
};

const HeaderOverrideContext = createContext<HeaderOverrideValue | null>(null);

export function HeaderOverrideProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<HeaderOverride>({});
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <HeaderOverrideContext.Provider value={value}>{children}</HeaderOverrideContext.Provider>;
}

export function useHeaderOverride(): HeaderOverrideValue {
  const value = useContext(HeaderOverrideContext);
  if (!value) {
    throw new Error("useHeaderOverride は HeaderOverrideProvider の内側で使う");
  }
  return value;
}

/** 画面がマウントされている間だけヘッダーの見出しを上書きする */
export function useSetHeaderOverride(override: HeaderOverride) {
  const { setOverride } = useHeaderOverride();
  const title = override.title;
  const titleMuted = override.titleMuted;
  useEffect(() => {
    setOverride({ title, titleMuted });
    return () => setOverride({});
  }, [setOverride, title, titleMuted]);
}
