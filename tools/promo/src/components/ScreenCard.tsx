import { Img, staticFile } from "remotion";
import { colors, shadow } from "../theme";

export const ScreenCard: React.FC<{
  readonly file: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly objectPosition?: string;
  readonly scale?: number;
  readonly opacity?: number;
  readonly radius?: number;
}> = ({
  file,
  left,
  top,
  width,
  height,
  objectPosition = "50% 50%",
  scale,
  opacity = 1,
  radius = 40,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        overflow: "hidden",
        borderRadius: radius,
        boxShadow: shadow,
        backgroundColor: colors.background,
        opacity,
      }}
    >
      <Img
        name={file}
        src={staticFile(file)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition,
          scale,
        }}
      />
    </div>
  );
};
