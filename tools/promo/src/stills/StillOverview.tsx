import { AbsoluteFill } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { ScreenCard } from "../components/ScreenCard";
import { ServiceMark, ServiceUrl } from "../components/ServiceMark";
import { fontFamily } from "../fonts";
import { colors } from "../theme";

const COLS = [
  { file: "shots/log-day.png", label: "飲酒記録", position: "50% 16%" },
  { file: "shots/cellar.png", label: "セラー", position: "50% 38%" },
  { file: "shots/notes.png", label: "ノート", position: "50% 30%" },
] as const;

export const StillOverview: React.FC = () => {
  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <ServiceMark top={56} />
      <div
        style={{
          position: "absolute",
          top: 36,
          right: 40,
          width: 132,
          height: 176,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MascotMark pose="default" height={176} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 200,
          top: 118,
          fontFamily,
          fontSize: 54,
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
          top: 276,
          fontFamily,
          fontSize: 26,
          fontWeight: 500,
          lineHeight: 1.45,
          color: colors.muted,
        }}
      >
        飲酒記録・セラー・テイスティングノート
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 318,
          fontFamily,
          fontSize: 26,
          fontWeight: 500,
          lineHeight: 1.45,
          color: colors.primary,
        }}
      >
        写真を撮ると、名前や種類を読み取る。
      </div>
      {COLS.map((col, index) => {
        const left = 48 + index * 344;
        return (
          <div key={col.file}>
            <div
              style={{
                position: "absolute",
                left,
                top: 372,
                width: 328,
                fontFamily,
                fontSize: 26,
                fontWeight: 700,
                color: colors.foreground,
              }}
            >
              {col.label}
            </div>
            <ScreenCard
              file={col.file}
              left={left}
              top={414}
              width={328}
              height={820}
              objectPosition={col.position}
              radius={28}
            />
          </div>
        );
      })}
      <ServiceUrl bottom={48} />
    </AbsoluteFill>
  );
};
