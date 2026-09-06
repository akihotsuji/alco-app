function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  if (!(key in value)) {
    return undefined;
  }
  return Reflect.get(value, key);
}

/** React Router が history.state に載せる idx。ディープリンク直開きは 0。 */
export function historyIdx(state: unknown): number | undefined {
  const idx = readProperty(state, "idx");
  return typeof idx === "number" ? idx : undefined;
}

export function historyHasFlag(state: unknown, flag: string): boolean {
  return readProperty(state, flag) === true;
}

/**
 * `photo-edit` のオーバーレイ用に 1 段積む history.state。
 * React Router の `idx` を 1 進めて引き継ぐ（後で `navigate(..., { replace: true })` したときに
 * router が正しい idx を書き戻せるようにする。idx が無いディープリンク直開きでは付けない）。
 */
export function withHistoryFlag(state: unknown, flag: string): Record<string, unknown> {
  const base = typeof state === "object" && state !== null ? { ...state } : {};
  const idx = historyIdx(state);
  return {
    ...base,
    ...(idx === undefined ? {} : { idx: idx + 1 }),
    [flag]: true,
  };
}

/** `location.state` に載せる写真の受け渡しフラグ（中央タブ / ホームのカメラ → `log-new`） */
export const PHOTO_HANDOFF_FLAG = "alcoPhotoHandoff";

export function photoHandoffState(): Record<string, true> {
  return { [PHOTO_HANDOFF_FLAG]: true };
}

/** 撮影 → 「使う」の直後に開かれた `log-new` かどうか。真なら既存の写真を「前回の残り」として消さない */
export function isPhotoHandoff(locationState: unknown): boolean {
  return historyHasFlag(locationState, PHOTO_HANDOFF_FLAG);
}
