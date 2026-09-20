import { renderSVG } from "uqr";
import { generateInviteToken, hashInviteToken } from "./cellar-crypto.ts";

export { generateInviteToken, hashInviteToken };

export function friendInviteJoinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/friends/join#t=${token}`;
}

export function friendInviteQrSvg(url: string): string {
  return renderSVG(url, {
    ecc: "M",
    border: 2,
    pixelSize: 4,
    whiteColor: "#ffffff",
    blackColor: "#2B261F",
  });
}
