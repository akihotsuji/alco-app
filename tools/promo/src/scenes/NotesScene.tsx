import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { SceneHeadline } from "../components/SceneHeadline";
import { ScreenCard } from "../components/ScreenCard";

export const NotesScene: React.FC = () => {
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
        {"飲んだ感想も、\nあとから振り返る"}
      </SceneHeadline>
      <ScreenCard
        file="shots/notes.png"
        left={70}
        top={500}
        width={940}
        height={1200}
        objectPosition="50% 32%"
        opacity={interpolate(frame, [0.15 * fps, 0.55 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}
        scale={interpolate(frame, [0.15 * fps, 7 * fps], [1.02, 1.08], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.2, 0, 0, 1),
          output: "perceptual-scale",
        })}
      />
    </AbsoluteFill>
  );
};
