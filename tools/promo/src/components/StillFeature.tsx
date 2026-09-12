import { AbsoluteFill } from "remotion";
import { fontFamily } from "../fonts";
import { STILL_HEIGHT, STILL_WIDTH, colors, placeShot } from "../theme";
import { BrandBackdrop } from "./BrandBackdrop";
import { MascotMark } from "./MascotMark";
import { ScreenCard } from "./ScreenCard";
import { ServiceMark, ServiceUrl } from "./ServiceMark";

const frame = placeShot({
  left: 64,
  top: 352,
  width: STILL_WIDTH - 128,
  height: STILL_HEIGHT - 352 - 96,
});

export const StillFeature: React.FC<{
  readonly title: string;
  readonly subtitle: string;
  readonly file: string;
}> = ({ title, subtitle, file }) => {
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
        {title}
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
        {subtitle}
      </div>
      <ScreenCard file={file} radius={36} {...frame} />
      <ServiceUrl bottom={40} />
    </AbsoluteFill>
  );
};
