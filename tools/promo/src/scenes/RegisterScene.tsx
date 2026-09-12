import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { fontFamily } from "../fonts";

export const RegisterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Register">
      <BrandBackdrop />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 150,
          fontFamily,
          fontSize: 72,
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
        気になった一本を、写真で残す
      </div>
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 430,
          width: 940,
          height: 1180,
          overflow: "hidden",
          borderRadius: 40,
          boxShadow: "10px 14px 28px #C9C2B6, -8px -8px 20px rgba(255,255,255,0.72)",
          opacity: interpolate(frame, [0.2 * fps, 0.7 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0.2 * fps, 0.7 * fps], ["0px 28px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.2, 0, 0, 1),
          }),
        }}
      >
        <Img
          src={staticFile("shots/log-new.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 18%",
            scale: interpolate(frame, [0.2 * fps, 7 * fps], [1.04, 1.14], {
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
