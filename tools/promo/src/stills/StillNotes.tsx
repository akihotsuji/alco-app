import { AbsoluteFill } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { ScreenCard } from "../components/ScreenCard";
import { ServiceMark, ServiceUrl } from "../components/ServiceMark";
import { fontFamily } from "../fonts";
import { colors } from "../theme";

export const StillNotes: React.FC = () => {
  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <ServiceMark top={56} />
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 108,
          fontFamily,
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.28,
          color: colors.foreground,
          letterSpacing: "-0.03em",
          whiteSpace: "pre-line",
        }}
      >
        {"飲んだ感想も、\nあとから振り返る"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 260,
          fontFamily,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.5,
          color: colors.muted,
        }}
      >
        写真とひとことで、味の記憶を残す。
      </div>
      <ScreenCard
        file="shots/notes.png"
        left={56}
        top={336}
        width={968}
        height={900}
        objectPosition="50% 34%"
        radius={36}
      />
      <ServiceUrl bottom={48} />
    </AbsoluteFill>
  );
};
