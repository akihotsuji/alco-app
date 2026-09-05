const KEYS = {
  composeMascot: "alco.photo.composeMascot",
  colorCorrection: "alco.photo.colorCorrection",
  cellarRecognize: "alco.cellar.recognize",
} as const;

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return raw === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // プライベートモード等では保存できない。既定値のまま動かす
  }
}

export function getComposeMascotPref(): boolean {
  return readFlag(KEYS.composeMascot, true);
}

export function setComposeMascotPref(value: boolean): void {
  writeFlag(KEYS.composeMascot, value);
}

export function getColorCorrectionPref(): boolean {
  return readFlag(KEYS.colorCorrection, true);
}

export function setColorCorrectionPref(value: boolean): void {
  writeFlag(KEYS.colorCorrection, value);
}

export function getCellarRecognizePref(): boolean {
  return readFlag(KEYS.cellarRecognize, true);
}

export function setCellarRecognizePref(value: boolean): void {
  writeFlag(KEYS.cellarRecognize, value);
}
