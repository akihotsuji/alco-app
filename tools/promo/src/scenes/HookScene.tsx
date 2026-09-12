import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { fontFamily } from "../fonts";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Hook">
      <BrandBackdrop />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 220,
          width: 1080,
          height: 1180,
          overflow: "hidden",
          scale: interpolate(frame, [0, 3 * fps], [1.08, 1.22], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.2, 0, 0, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <Img
          src={staticFile("shots/log-day.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 28%",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 980,
          width: 1080,
          height: 420,
          backgroundColor: "#E6E0D6",
          opacity: 0.92,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1080,
          fontFamily,
          fontSize: 86,
          fontWeight: 700,
          lineHeight: 1.2,
          color: "#2B261F",
          letterSpacing: "-0.03em",
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0, 0.5 * fps], ["0px 16px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.2, 0, 0, 1),
          }),
        }}
      >
        あのお酒、なんだっけ？
      </div>
    </AbsoluteFill>
  );
};
