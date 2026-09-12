import { Img, staticFile } from "remotion";

export const ScreenCrop: React.FC<{
  readonly file: string;
  readonly objectPosition?: string;
  readonly scale?: number;
  readonly borderRadius?: number;
}> = ({ file, objectPosition = "50% 30%", scale = 1.15, borderRadius = 36 }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius,
        boxShadow: "10px 14px 28px #C9C2B6, -8px -8px 20px rgba(255,255,255,0.72)",
        backgroundColor: "#E6E0D6",
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
