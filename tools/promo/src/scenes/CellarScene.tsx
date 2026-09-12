import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { fontFamily } from "../fonts";

export const CellarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Cellar">
      <BrandBackdrop />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 150,
          fontFamily,
          fontSize: 70,
          fontWeight: 700,
          lineHeight: 1.25,
          color: "#2B261F",
          letterSpacing: "-0.03em",
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        手持ちのお酒が、自分だけの棚に
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 400,
          width: 1080,
          height: 1320,
          overflow: "hidden",
          opacity: interpolate(frame, [0.15 * fps, 0.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Img
          src={staticFile("shots/cellar.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 38%",
            scale: interpolate(frame, [0, 8 * fps], [1.08, 1.22], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.2, 0, 0, 1),
              output: "perceptual-scale",
            }),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
