import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type PhotoEditContextKind = "log" | "cellar" | "note";

type PhotoEditValue = {
  open: boolean;
  kind: PhotoEditContextKind;
  openPhotoEdit: (kind: PhotoEditContextKind) => void;
  closePhotoEdit: () => void;
};

const PhotoEditContext = createContext<PhotoEditValue>({
  open: false,
  kind: "log",
  openPhotoEdit: () => {},
  closePhotoEdit: () => {},
});

const HISTORY_FLAG = "alcoPhotoEdit";

export function PhotoEditProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PhotoEditContextKind>("log");

  useEffect(() => {
    const onPop = () => {
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openPhotoEdit = useCallback((nextKind: PhotoEditContextKind) => {
    setKind(nextKind);
    setOpen(true);
    window.history.pushState({ [HISTORY_FLAG]: true }, "");
  }, []);

  const closePhotoEdit = useCallback(() => {
    const state = window.history.state as { [HISTORY_FLAG]?: boolean } | null;
    if (state?.[HISTORY_FLAG]) {
      window.history.back();
      return;
    }
    setOpen(false);
  }, []);

  return (
    <PhotoEditContext.Provider value={{ open, kind, openPhotoEdit, closePhotoEdit }}>
      {children}
    </PhotoEditContext.Provider>
  );
}

export function usePhotoEdit(): PhotoEditValue {
  return useContext(PhotoEditContext);
}
