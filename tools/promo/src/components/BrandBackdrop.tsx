import { AbsoluteFill } from "remotion";
import { usePromoFont } from "../fonts";
import { colors } from "../theme";

export const BrandBackdrop: React.FC = () => {
  usePromoFont();

  return (
    <AbsoluteFill
      name="Backdrop"
      style={{
        backgroundColor: colors.background,
      }}
    />
  );
};
