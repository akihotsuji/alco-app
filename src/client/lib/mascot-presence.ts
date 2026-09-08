export const MASCOT_PRESENCES = ["upright", "resting", "heavy"] as const;

export type MascotPresence = (typeof MASCOT_PRESENCES)[number];

export type MascotPresenceInput = {
  /** 今日の杯数が取れたときだけ数を渡す。不明なら自動で元気にも多量にもしない */
  todayCount: number | null;
  preview?: "heavy" | null;
};

/**
 * 多量の横倒れは自動表示条件が未確定（設定上限なし）。
 * preview 以外では upright / resting だけ返す。
 */
export function resolveMascotPresence(input: MascotPresenceInput): {
  presence: MascotPresence;
  autoHeavy: false;
} {
  if (input.preview === "heavy") {
    return { presence: "heavy", autoHeavy: false };
  }
  if (input.todayCount === null) {
    return { presence: "resting", autoHeavy: false };
  }
  if (input.todayCount === 0) {
    return { presence: "resting", autoHeavy: false };
  }
  return { presence: "upright", autoHeavy: false };
}

export function parseMascotPreview(raw: string | null): "heavy" | null {
  return raw === "heavy" ? "heavy" : null;
}

/** 自動表示条件は未確定。閾値を独自に持たない */
export const MASCOT_HEAVY_AUTO_RULE = "undecided" as const;
