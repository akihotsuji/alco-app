import { AbsoluteFill } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
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
          top: 28,
          right: 32,
          width: 140,
          height: 186,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MascotMark pose="default" height={160} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 200,
          top: 118,
          fontFamily,
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.28,
          color: colors.foreground,
          letterSpacing: "-0.03em",
          whiteSpace: "pre-line",
        }}
      >
        {"飲んだ記録も、\n感想も、振り返る"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 276,
          fontFamily,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.5,
          color: colors.muted,
        }}
      >
        日ごとの一杯と、テイスティングノート。
      </div>
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 336,
          width: 470,
          fontFamily,
          fontSize: 24,
          fontWeight: 700,
          color: colors.foreground,
        }}
      >
        飲酒記録
      </div>
      <div
        style={{
          position: "absolute",
          left: 554,
          top: 336,
          width: 470,
          fontFamily,
          fontSize: 24,
          fontWeight: 700,
          color: colors.foreground,
        }}
      >
        ノート
      </div>
      <ScreenCard
        file="shots/log-day.png"
        left={56}
        top={376}
        width={470}
        height={860}
        objectPosition="50% 14%"
        radius={32}
      />
      <ScreenCard
        file="shots/notes.png"
        left={554}
        top={376}
        width={470}
        height={860}
        objectPosition="50% 30%"
        radius={32}
      />
      <ServiceUrl bottom={48} />
    </AbsoluteFill>
  );
};
