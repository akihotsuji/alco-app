import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { SceneHeadline } from "../components/SceneHeadline";
import { VideoShot } from "../components/VideoShot";

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
      <VideoShot
        file="shots/notes.png"
        opacity={interpolate(frame, [0.15 * fps, 0.55 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}
      />
    </AbsoluteFill>
  );
};
