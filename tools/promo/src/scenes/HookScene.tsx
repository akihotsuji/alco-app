import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { SceneHeadline } from "../components/SceneHeadline";
import { ScreenCard } from "../components/ScreenCard";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <SceneHeadline
        fontSize={72}
        opacity={interpolate(frame, [0, 0.4 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}
      >
        あのお酒、なんだっけ？
      </SceneHeadline>
      <ScreenCard
        file="shots/note-detail.png"
        left={80}
        top={460}
        width={920}
        height={1240}
        objectPosition="50% 28%"
        scale={interpolate(frame, [0, 3 * fps], [1.04, 1.12], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.2, 0, 0, 1),
          output: "perceptual-scale",
        })}
      />
    </AbsoluteFill>
  );
};
