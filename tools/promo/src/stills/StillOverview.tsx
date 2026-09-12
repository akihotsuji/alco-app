import { AbsoluteFill, Img, staticFile } from "remotion";
import { BrandBackdrop } from "../components/BrandBackdrop";
import { MascotMark } from "../components/MascotMark";
import { fontFamily } from "../fonts";

export const StillOverview: React.FC = () => {
  return (
    <AbsoluteFill name="Still overview">
      <BrandBackdrop />
      <div
        style={{
          position: "absolute",
          top: 92,
          right: 72,
        }}
      >
        <MascotMark pose="default" height={150} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 110,
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
          top: 168,
          fontFamily,
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.22,
          color: "#2B261F",
          letterSpacing: "-0.03em",
        }}
      >
        お酒の記憶に、しおりを。
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 360,
          fontFamily,
          fontSize: 32,
          fontWeight: 500,
          lineHeight: 1.5,
          color: "#5C564C",
        }}
      >
        ボトル、飲んだ記録、感想を写真で残す。
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 500,
          width: 300,
          height: 640,
          overflow: "hidden",
          borderRadius: 32,
          boxShadow: "8px 10px 20px #C9C2B6, -6px -6px 14px rgba(255,255,255,0.7)",
        }}
      >
        <Img
          src={staticFile("shots/home.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 18%" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 390,
          top: 470,
          width: 300,
          height: 700,
          overflow: "hidden",
          borderRadius: 32,
          boxShadow: "8px 10px 20px #C9C2B6, -6px -6px 14px rgba(255,255,255,0.7)",
        }}
      >
        <Img
          src={staticFile("shots/cellar.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 32%" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 716,
          top: 500,
          width: 300,
          height: 640,
          overflow: "hidden",
          borderRadius: 32,
          boxShadow: "8px 10px 20px #C9C2B6, -6px -6px 14px rgba(255,255,255,0.7)",
        }}
      >
        <Img
          src={staticFile("shots/notes.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 88,
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
