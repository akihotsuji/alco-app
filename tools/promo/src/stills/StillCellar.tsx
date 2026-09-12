import { AbsoluteFill, Img, staticFile } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { fontFamily } from "../fonts";

export const StillCellar: React.FC = () => {
  return (
    <AbsoluteFill name="Still cellar">
      <BrandBackdrop />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 96,
          fontFamily,
          fontSize: 28,
          fontWeight: 600,
          color: "#7A3538",
        }}
      >
        酒のしおり
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 150,
          fontFamily,
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.22,
          color: "#2B261F",
          letterSpacing: "-0.03em",
        }}
      >
        手持ちのお酒が、自分だけの棚に
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 340,
          fontFamily,
          fontSize: 32,
          fontWeight: 500,
          lineHeight: 1.5,
          color: "#5C564C",
        }}
      >
        気になったボトルを写真で並べておく。
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 460,
          width: 900,
          height: 740,
          overflow: "hidden",
          borderRadius: 36,
          boxShadow: "10px 14px 28px #C9C2B6, -8px -8px 20px rgba(255,255,255,0.72)",
        }}
      >
        <Img
          src={staticFile("shots/cellar.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 42%",
            scale: 1.18,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          fontFamily,
          fontSize: 30,
          fontWeight: 600,
          color: "#5C564C",
        }}
      >
        sake-shiori.com
      </div>
    </AbsoluteFill>
  );
};
