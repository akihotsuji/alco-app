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

const UNDO_DRINK_LOG_ID = "undoDrinkLogId";

/** `log-new` から日別へ、到着先でだけ undo トーストを組み立てるための一時状態。 */
export function drinkLogUndoState(logId: string): Record<string, string> {
  return { [UNDO_DRINK_LOG_ID]: logId };
}

export function undoDrinkLogId(locationState: unknown): string | null {
  const value = readProperty(locationState, UNDO_DRINK_LOG_ID);
  return typeof value === "string" ? value : null;
}

export type BottleShelfEvent = {
  bottleId: string;
  createdAt: string;
};

const CONSUME_LEFT_KEY = "left";
const CONSUME_UNDO_KEY = "consumeUndo";
const PLACED_KEY = "placed";

function readShelfEvent(value: unknown): BottleShelfEvent | null {
  const bottleId = readProperty(value, "bottleId");
  const createdAt = readProperty(value, "createdAt");
  if (typeof bottleId !== "string" || typeof createdAt !== "string") {
    return null;
  }
  if (bottleId.length === 0 || createdAt.length === 0) {
    return null;
  }
  return { bottleId, createdAt };
}

/** 開栓成功後の `/cellar` 到着。undo トーストと M-10 用 */
export function bottleConsumeState(left: BottleShelfEvent): Record<string, unknown> {
  return { [CONSUME_LEFT_KEY]: left, [CONSUME_UNDO_KEY]: true };
}

export function consumeLeftEvent(locationState: unknown): BottleShelfEvent | null {
  return readShelfEvent(readProperty(locationState, CONSUME_LEFT_KEY));
}

export function consumeUndoRequested(locationState: unknown): boolean {
  return readProperty(locationState, CONSUME_UNDO_KEY) === true;
}

/** 復元・追加のあと一覧へ戻ったときの M-32 */
export function bottlePlacedState(placed: BottleShelfEvent): Record<string, unknown> {
  return { [PLACED_KEY]: placed };
}

export function placedBottleEvent(locationState: unknown): BottleShelfEvent | null {
  return readShelfEvent(readProperty(locationState, PLACED_KEY));
}

const CELLAR_MOTION_STORAGE_KEY = "cellar.shelfEvent";

export type RememberedShelfEvent = BottleShelfEvent & { kind: "left" | "placed" };

export function rememberShelfEvent(event: RememberedShelfEvent): void {
  try {
    sessionStorage.setItem(CELLAR_MOTION_STORAGE_KEY, JSON.stringify(event));
  } catch {
    // プライベートモードなど。history.state だけで再生する。
  }
}

/** React Router の `usr`（location.state）を消して再演出を防ぐ */
export function clearRouterLocationState(): void {
  const current = window.history.state;
  if (typeof current === "object" && current !== null) {
    window.history.replaceState({ ...current, usr: null }, "");
  }
}

export type CellarVisit = {
  event: RememberedShelfEvent;
  toastShown: boolean;
  leavePlayed: boolean;
  placedPlayed: boolean;
};

let cellarVisit: CellarVisit | null = null;

function sameShelfEvent(left: RememberedShelfEvent, right: RememberedShelfEvent): boolean {
  return (
    left.kind === right.kind &&
    left.bottleId === right.bottleId &&
    left.createdAt === right.createdAt
  );
}

/** 開栓 / 復元の棚イベントを 1 訪問ぶん保持する。トースト表示後も消さない */
export function captureCellarVisit(event: RememberedShelfEvent): CellarVisit {
  if (cellarVisit && sameShelfEvent(cellarVisit.event, event)) {
    return cellarVisit;
  }
  cellarVisit = {
    event,
    toastShown: false,
    leavePlayed: false,
    placedPlayed: false,
  };
  return cellarVisit;
}

export function currentCellarVisit(): CellarVisit | null {
  return cellarVisit;
}

export function markCellarVisitToastShown(): void {
  if (cellarVisit) {
    cellarVisit.toastShown = true;
  }
}

export function markCellarVisitLeavePlayed(): void {
  if (cellarVisit) {
    cellarVisit.leavePlayed = true;
  }
}

export function markCellarVisitPlacedPlayed(): void {
  if (cellarVisit) {
    cellarVisit.placedPlayed = true;
  }
}

export function releaseCellarVisit(): void {
  cellarVisit = null;
}

export function isCellarListPath(pathname: string): boolean {
  return pathname === "/cellar";
}

/**
 * sessionStorage は 1 回だけ取る。すでに visit があればストレージを触らない
 * （Strict Mode の再マウントで二重消費しない）。
 */
export function takeRememberedIntoVisit(): RememberedShelfEvent | null {
  if (cellarVisit) {
    return cellarVisit.event;
  }
  const taken = takeRememberedShelfEvent();
  if (!taken) {
    return null;
  }
  return captureCellarVisit(taken).event;
}

/** q が現在の URL と同じなら null（navigate しない） */
export function nextBottleSearchParams(
  current: URLSearchParams,
  q: string,
): URLSearchParams | null {
  const next = new URLSearchParams(current);
  if (q) {
    next.set("q", q);
  } else {
    next.delete("q");
  }
  return next.toString() === current.toString() ? null : next;
}

/** `setSearchParams` の replace で location.state を落とさない */
export function replaceSearchKeepState(locationState: unknown): { replace: true; state: unknown } {
  return { replace: true, state: locationState ?? null };
}

export function takeRememberedShelfEvent(): RememberedShelfEvent | null {
  try {
    const raw = sessionStorage.getItem(CELLAR_MOTION_STORAGE_KEY);
    sessionStorage.removeItem(CELLAR_MOTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    const event = readShelfEvent(parsed);
    const kind = readProperty(parsed, "kind");
    if (!event || (kind !== "left" && kind !== "placed")) {
      return null;
    }
    return { ...event, kind };
  } catch {
    return null;
  }
}
