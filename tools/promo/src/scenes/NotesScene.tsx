import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { fontFamily } from "../fonts";

export const NotesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Notes">
      <BrandBackdrop />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 150,
          fontFamily,
          fontSize: 68,
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
        飲んだ感想も、あとから振り返る
      </div>
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 430,
          width: 940,
          height: 1220,
          overflow: "hidden",
          borderRadius: 40,
          boxShadow: "10px 14px 28px #C9C2B6, -8px -8px 20px rgba(255,255,255,0.72)",
          opacity: interpolate(frame, [0.15 * fps, 0.55 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0.15 * fps, 7 * fps], [1.02, 1.1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.2, 0, 0, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <Img
          src={staticFile("shots/notes.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 22%",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
