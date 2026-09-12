import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { SceneHeadline } from "../components/SceneHeadline";
import { ScreenCard } from "../components/ScreenCard";

export const RegisterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <SceneHeadline
        opacity={interpolate(frame, [0, 0.4 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}
      >
        {"写真を撮ると、\n名前や種類を読み取る"}
      </SceneHeadline>
      <ScreenCard
        file="shots/log-new.png"
        left={70}
        top={500}
        width={940}
        height={1200}
        objectPosition="50% 8%"
        opacity={interpolate(frame, [0.15 * fps, 0.55 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}
        scale={interpolate(frame, [0.15 * fps, 7 * fps], [1, 1.04], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.2, 0, 0, 1),
          output: "perceptual-scale",
        })}
      />
    </AbsoluteFill>
  );
};
