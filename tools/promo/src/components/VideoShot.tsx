import { VIDEO_HEIGHT, VIDEO_WIDTH, placeShot, safe } from "../theme";
import { ScreenCard } from "./ScreenCard";

const VIDEO_SHOT_TOP = 430;
const VIDEO_SHOT_BOTTOM = 64;

const videoShotFrame = placeShot({
  left: safe.videoSide,
  top: VIDEO_SHOT_TOP,
  width: VIDEO_WIDTH - safe.videoSide * 2,
  height: VIDEO_HEIGHT - VIDEO_SHOT_TOP - VIDEO_SHOT_BOTTOM,
});

export const VideoShot: React.FC<{
  readonly file: string;
  readonly opacity?: number;
}> = ({ file, opacity }) => {
  return <ScreenCard file={file} opacity={opacity} radius={36} {...videoShotFrame} />;
};
