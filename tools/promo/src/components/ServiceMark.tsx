import { fontFamily } from "../fonts";
import { colors } from "../theme";

export const ServiceMark: React.FC<{
  readonly top?: number;
  readonly left?: number;
  readonly fontSize?: number;
}> = ({ top = 72, left = 64, fontSize = 28 }) => {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        fontFamily,
        fontSize,
        fontWeight: 700,
        color: colors.primary,
      }}
    >
      酒のしおり
    </div>
  );
};

export const ServiceUrl: React.FC<{
  readonly bottom?: number;
  readonly left?: number;
  readonly fontSize?: number;
}> = ({ bottom = 64, left = 64, fontSize = 28 }) => {
  return (
    <div
      style={{
        position: "absolute",
        left,
        bottom,
        fontFamily,
        fontSize,
        fontWeight: 500,
        color: colors.muted,
      }}
    >
      sake-shiori.com
    </div>
  );
};
