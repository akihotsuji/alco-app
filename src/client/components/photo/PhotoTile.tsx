import { Camera } from "lucide-react";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";

type PhotoTileProps = {
  onClick: () => void;
  showMascot?: boolean;
};

export function PhotoTile({ onClick, showMascot = true }: PhotoTileProps) {
  return (
    <button type="button" className="photo-tile" onClick={onClick}>
      <span className="photo-tile-center">
        <Camera size={28} aria-hidden />
        <span>写真を撮る</span>
      </span>
      {showMascot ? (
        <span className="photo-tile-mascot">
          <Mascot pose="surprised" size={48} aria-hidden />
        </span>
      ) : null}
    </button>
  );
}
