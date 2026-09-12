import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { fontFamily } from "../fonts";
import { colors } from "../theme";

export const EndScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 400,
          display: "flex",
          justifyContent: "center",
          zIndex: 2,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <MascotMark pose="default" height={260} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 720,
          zIndex: 2,
          textAlign: "center",
          fontFamily,
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.3,
          color: colors.foreground,
          letterSpacing: "-0.03em",
          whiteSpace: "pre-line",
          opacity: interpolate(frame, [8, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {"お酒の記憶に、\nしおりを。"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1000,
          zIndex: 2,
          textAlign: "center",
          fontFamily,
          fontSize: 48,
          fontWeight: 700,
          color: colors.primary,
          opacity: interpolate(frame, [16, 28], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        酒のしおり
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1080,
          zIndex: 2,
          textAlign: "center",
          fontFamily,
          fontSize: 40,
          fontWeight: 500,
          color: colors.muted,
          opacity: interpolate(frame, [22, 34], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        sake-shiori.com
      </div>
    </AbsoluteFill>
  );
};
