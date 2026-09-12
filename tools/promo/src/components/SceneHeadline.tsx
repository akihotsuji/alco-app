import { fontFamily } from "../fonts";
import { colors } from "../theme";

export const SceneHeadline: React.FC<{
  readonly children: string;
  readonly opacity?: number;
  readonly fontSize?: number;
  readonly top?: number;
  readonly side?: number;
}> = ({ children, opacity = 1, fontSize = 64, top = 220, side = 72 }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: side,
        right: side,
        top,
        zIndex: 2,
        fontFamily,
        fontSize,
        fontWeight: 700,
        lineHeight: 1.3,
        color: colors.foreground,
        letterSpacing: "-0.03em",
        whiteSpace: "pre-line",
        opacity,
      }}
    >
      {children}
    </div>
  );
};
