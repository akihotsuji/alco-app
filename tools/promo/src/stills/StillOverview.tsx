import { AbsoluteFill } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { ScreenCard } from "../components/ScreenCard";
import { ServiceMark, ServiceUrl } from "../components/ServiceMark";
import { fontFamily } from "../fonts";
import { STILL_HEIGHT, STILL_WIDTH, colors, placeShot } from "../theme";

const COLS = [
  { file: "shots/log-day.png", label: "飲酒記録" },
  { file: "shots/cellar.png", label: "セラー" },
  { file: "shots/notes.png", label: "ノート" },
] as const;

const SIDE = 36;
const GAP = 16;
const LABEL_TOP = 368;
const CARD_TOP = 408;
const CARD_BOTTOM = STILL_HEIGHT - 96;

export const StillOverview: React.FC = () => {
  const colWidth = (STILL_WIDTH - SIDE * 2 - GAP * 2) / 3;

  return (
    <AbsoluteFill>
      <BrandBackdrop />
      <ServiceMark top={56} />
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 32,
          width: 148,
          height: 196,
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
        const boxLeft = SIDE + index * (colWidth + GAP);
        const frame = placeShot({
          left: boxLeft,
          top: CARD_TOP,
          width: colWidth,
          height: CARD_BOTTOM - CARD_TOP,
        });
        return (
          <div key={col.file}>
            <div
              style={{
                position: "absolute",
                left: frame.left,
                top: LABEL_TOP,
                width: frame.width,
                fontFamily,
                fontSize: 26,
                fontWeight: 700,
                color: colors.foreground,
              }}
            >
              {col.label}
            </div>
            <ScreenCard file={col.file} radius={28} {...frame} />
          </div>
        );
      })}
      <ServiceUrl bottom={40} />
    </AbsoluteFill>
  );
};
