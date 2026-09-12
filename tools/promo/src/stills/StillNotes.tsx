import { AbsoluteFill } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { ScreenCard } from "../components/ScreenCard";
import { ServiceMark, ServiceUrl } from "../components/ServiceMark";
import { fontFamily } from "../fonts";
import { STILL_HEIGHT, STILL_WIDTH, colors, placeShot } from "../theme";

const SIDE = 48;
const GAP = 24;
const LABEL_TOP = 336;
const CARD_TOP = 376;
const CARD_BOTTOM = STILL_HEIGHT - 96;
const COL_WIDTH = (STILL_WIDTH - SIDE * 2 - GAP) / 2;

const COLS = [
  { file: "shots/log-day.png", label: "飲酒記録" },
  { file: "shots/notes.png", label: "ノート" },
] as const;

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
      {COLS.map((col, index) => {
        const boxLeft = SIDE + index * (COL_WIDTH + GAP);
        const frame = placeShot({
          left: boxLeft,
          top: CARD_TOP,
          width: COL_WIDTH,
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
                fontSize: 24,
                fontWeight: 700,
                color: colors.foreground,
              }}
            >
              {col.label}
            </div>
            <ScreenCard file={col.file} radius={32} {...frame} />
          </div>
        );
      })}
      <ServiceUrl bottom={40} />
    </AbsoluteFill>
  );
};
