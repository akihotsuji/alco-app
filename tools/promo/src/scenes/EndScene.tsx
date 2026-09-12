import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { fontFamily } from "../fonts";

export const EndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BrandBackdrop />
      <div
        style={{
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0, 0.5 * fps], ["0px 12px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.2, 0, 0, 1),
          }),
        }}
      >
        <MascotMark pose="default" height={260} />
      </div>
      <div
        style={{
          marginTop: 36,
          paddingLeft: 80,
          paddingRight: 80,
          textAlign: "center",
          fontFamily,
          fontSize: 78,
          fontWeight: 700,
          lineHeight: 1.25,
          color: "#2B261F",
          letterSpacing: "-0.03em",
          opacity: interpolate(frame, [0.2 * fps, 0.7 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        お酒の記憶に、しおりを。
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily,
          fontSize: 44,
          fontWeight: 600,
          color: "#7A3538",
          opacity: interpolate(frame, [0.5 * fps, 1 * fps], [0, 1], {
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
          marginTop: 16,
          fontFamily,
          fontSize: 40,
          fontWeight: 500,
          color: "#5C564C",
          opacity: interpolate(frame, [0.7 * fps, 1.2 * fps], [0, 1], {
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
