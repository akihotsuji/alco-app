import { AbsoluteFill } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { ScreenCard } from "../components/ScreenCard";
import { ServiceMark, ServiceUrl } from "../components/ServiceMark";
import { fontFamily } from "../fonts";
import { STILL_HEIGHT, STILL_WIDTH, colors, placeShot } from "../theme";

const frame = placeShot({
  left: 64,
  top: 352,
  width: STILL_WIDTH - 128,
  height: STILL_HEIGHT - 352 - 96,
});

export const StillCellar: React.FC = () => {
  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <ServiceMark top={56} />
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 32,
          width: 140,
          height: 186,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MascotMark pose="default" height={160} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 200,
          top: 118,
          fontFamily,
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.28,
          color: colors.foreground,
          letterSpacing: "-0.03em",
          whiteSpace: "pre-line",
        }}
      >
        {"手持ちのお酒が、\n自分だけの棚に"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 276,
          fontFamily,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.5,
          color: colors.muted,
        }}
      >
        写真から名前や種類を入れて、棚に並べる。
      </div>
      <ScreenCard file="shots/cellar.png" radius={36} {...frame} />
      <ServiceUrl bottom={40} />
    </AbsoluteFill>
  );
};
