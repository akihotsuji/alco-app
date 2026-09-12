import { AbsoluteFill } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { ScreenCard } from "../components/ScreenCard";
import { ServiceMark, ServiceUrl } from "../components/ServiceMark";
import { fontFamily } from "../fonts";
import { colors } from "../theme";

export const StillOverview: React.FC = () => {
  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <ServiceMark top={56} />
      <div style={{ position: "absolute", top: 40, right: 48 }}>
        <MascotMark pose="default" height={108} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 180,
          top: 108,
          fontFamily,
          fontSize: 58,
          fontWeight: 700,
          lineHeight: 1.25,
          color: colors.foreground,
          letterSpacing: "-0.03em",
          whiteSpace: "pre-line",
        }}
      >
        {"お酒の記憶に、\nしおりを。"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 272,
          fontFamily,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.5,
          color: colors.muted,
        }}
      >
        ボトル、飲んだ記録、感想を写真で残す。
      </div>
      <ScreenCard
        file="shots/note-detail.png"
        left={72}
        top={348}
        width={936}
        height={880}
        objectPosition="50% 30%"
        radius={36}
      />
      <ServiceUrl bottom={48} />
    </AbsoluteFill>
  );
};
