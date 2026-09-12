import { Img, staticFile } from "remotion";

export const MascotMark: React.FC<{
  readonly pose?: "default" | "surprised" | "cheer" | "rest";
  readonly height?: number;
}> = ({ pose = "default", height = 220 }) => {
  return (
    <Img
      name={`Mascot ${pose}`}
      src={staticFile(`mascot/mascot-${pose}.svg`)}
      style={{
        height,
        width: height * 0.75,
      }}
    />
  );
};
