import type { PhotoContentType, PhotoKind } from "@/shared/constants.ts";

function photoBaseFromR2Key(r2Key: string): string {
  const name = r2Key.includes("/") ? r2Key.slice(r2Key.lastIndexOf("/") + 1) : r2Key;
  const dot = name.indexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function photoThumbR2Key(r2Key: string, kind: PhotoKind): string {
  const base = photoBaseFromR2Key(r2Key);
  return kind === "cutout" ? `${base}.thumb.png` : `${base}.thumb.jpg`;
}

export function photoDerivedR2Keys(r2Key: string): string[] {
  const base = photoBaseFromR2Key(r2Key);
  return [`${base}.thumb.jpg`, `${base}.thumb.png`];
}

export function photoR2KeysToDelete(r2Key: string): string[] {
  return [r2Key, ...photoDerivedR2Keys(r2Key)];
}

export function photoThumbContentType(kind: PhotoKind): PhotoContentType {
  return kind === "cutout" ? "image/png" : "image/jpeg";
}
