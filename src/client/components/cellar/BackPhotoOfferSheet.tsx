import { Camera, Images } from "lucide-react";
import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import type { ImagePickSource } from "@/client/lib/photo/pick-image.ts";

export const BACK_PHOTO_OFFER_COPY = {
  title: "裏ラベルも登録しますか？",
  bodyRecognize: "裏ラベルもあると読み取りが正確になります。両面がそろってから読み取ります。",
  bodyPlain: "裏ラベルはあとからでも追加できます。",
  capture: "裏ラベルを撮る",
  library: "裏ラベルを選ぶ",
  skipRecognize: "表面だけで読み取る",
  skipPlain: "今はしない",
} as const;

type BackPhotoOfferSheetProps = {
  open: boolean;
  /** 設定でラベル読み取りが ON のとき。文言だけ変える */
  recognize: boolean;
  onPick: (source: ImagePickSource) => void;
  onSkip: () => void;
};

/** `bottle-new` B1c。表面を付けた直後に 1 回だけ、裏ラベルも付けるかを聞く */
export function BackPhotoOfferSheet({ open, recognize, onPick, onSkip }: BackPhotoOfferSheetProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onSkip();
        }
      }}
    >
      <DialogContent className="app-sheet-panel back-offer-sheet">
        <DialogTitle className="text-[length:var(--text-title)] font-semibold leading-[1.3]">
          {BACK_PHOTO_OFFER_COPY.title}
        </DialogTitle>
        <DialogDescription className="text-base text-foreground">
          {recognize ? BACK_PHOTO_OFFER_COPY.bodyRecognize : BACK_PHOTO_OFFER_COPY.bodyPlain}
        </DialogDescription>
        <Button type="button" onClick={() => onPick("camera")}>
          <Camera size={18} aria-hidden />
          {BACK_PHOTO_OFFER_COPY.capture}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onPick("library")}>
          <Images size={18} aria-hidden />
          {BACK_PHOTO_OFFER_COPY.library}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          {recognize ? BACK_PHOTO_OFFER_COPY.skipRecognize : BACK_PHOTO_OFFER_COPY.skipPlain}
        </Button>
      </DialogContent>
    </DialogRoot>
  );
}
