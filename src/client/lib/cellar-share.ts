import { type Bottle, bottleSchema } from "@/shared/bottles.ts";
import type { CellarSummary } from "@/shared/cellars.ts";
import { CELLAR_PERSONAL_NAME } from "@/shared/constants.ts";

export const JOIN_TOKEN_STORAGE_KEY = "cellar.joinToken";

export function newOperationKey(): string {
  return crypto.randomUUID();
}

export function parseJoinHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const token = params.get("t")?.trim() ?? "";
  return token.length >= 32 ? token : null;
}

export function readJoinToken(): string | null {
  try {
    const stored = sessionStorage.getItem(JOIN_TOKEN_STORAGE_KEY);
    return stored && stored.length >= 32 ? stored : null;
  } catch {
    return null;
  }
}

export function writeJoinToken(token: string): void {
  try {
    sessionStorage.setItem(JOIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // プライベートモード等
  }
}

export function clearJoinToken(): void {
  try {
    sessionStorage.removeItem(JOIN_TOKEN_STORAGE_KEY);
  } catch {
    //
  }
}

export function captureJoinTokenFromLocation(
  hash: string,
  replaceUrl: (url: string) => void,
): string | null {
  const fromHash = parseJoinHash(hash);
  if (fromHash) {
    writeJoinToken(fromHash);
    const next = `${window.location.pathname}${window.location.search}`;
    replaceUrl(next);
    return fromHash;
  }
  return readJoinToken();
}

export function readSelectedCellarId(): string | null {
  try {
    const raw = localStorage.getItem("cellar.selectedId");
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writeSelectedCellarId(id: string): void {
  try {
    localStorage.setItem("cellar.selectedId", id);
  } catch {
    //
  }
}

export function resolveSelectedCellar(
  items: readonly CellarSummary[],
  storedId: string | null,
): CellarSummary | undefined {
  if (items.length === 0) {
    return undefined;
  }
  const stored = storedId ? items.find((item) => item.id === storedId) : undefined;
  if (stored) {
    return stored;
  }
  return items.find((item) => item.kind === "personal") ?? items[0];
}

export function cellarPeopleLabel(cellar: Pick<CellarSummary, "kind" | "memberCount">): string {
  if (cellar.kind === "personal") {
    return "自分だけ";
  }
  return `${cellar.memberCount}人`;
}

export function cellarDisplayName(cellar: Pick<CellarSummary, "kind" | "name">): string {
  return cellar.kind === "personal" ? CELLAR_PERSONAL_NAME : cellar.name;
}

const BOTTLE_COMPARE_FIELDS = [
  ["name", "品名"],
  ["drinkType", "種類"],
  ["producer", "生産者"],
  ["origin", "産地"],
  ["variety", "品種"],
  ["vintage", "ヴィンテージ"],
  ["purchasedOn", "購入日"],
  ["priceJpy", "購入価格"],
  ["shop", "購入場所"],
  ["storedOn", "保管日"],
  ["storage", "保管場所"],
  ["memo", "メモ"],
] as const;

export type ConflictFieldKey = (typeof BOTTLE_COMPARE_FIELDS)[number][0] | "photo";

export type ConflictField = {
  key: ConflictFieldKey;
  label: string;
  current: string;
  mine: string;
  bothChanged: boolean;
  prefer: "current" | "mine";
};

function fieldText(bottle: Bottle, key: Exclude<ConflictFieldKey, "photo">): string {
  const value = bottle[key];
  if (value === null || value === undefined || value === "") {
    return "（なし）";
  }
  return String(value);
}

export function conflictFields(input: {
  initial: Bottle;
  mine: Bottle;
  current: Bottle;
}): ConflictField[] {
  const fields: ConflictField[] = [];
  for (const [key, label] of BOTTLE_COMPARE_FIELDS) {
    const initialValue = fieldText(input.initial, key);
    const mineValue = fieldText(input.mine, key);
    const currentValue = fieldText(input.current, key);
    const changedByMe = mineValue !== initialValue;
    const changedByThem = currentValue !== initialValue;
    if (!changedByMe && !changedByThem) {
      continue;
    }
    fields.push({
      key,
      label,
      current: currentValue,
      mine: mineValue,
      bothChanged: changedByMe && changedByThem,
      prefer: changedByMe && !changedByThem ? "mine" : "current",
    });
  }
  const photoKey = (bottle: Bottle) => bottle.photos.map((photo) => photo.id).join(",");
  const initialPhoto = photoKey(input.initial);
  const minePhoto = photoKey(input.mine);
  const currentPhoto = photoKey(input.current);
  if (minePhoto !== initialPhoto || currentPhoto !== initialPhoto) {
    fields.push({
      key: "photo",
      label: "写真",
      current: currentPhoto ? "現在の写真" : "（なし）",
      mine: minePhoto ? "自分が選んだ写真" : "（なし）",
      bothChanged: minePhoto !== initialPhoto && currentPhoto !== initialPhoto,
      prefer: minePhoto !== initialPhoto && currentPhoto === initialPhoto ? "mine" : "current",
    });
  }
  return fields;
}

export function parseConflictBottle(value: unknown): Bottle | null {
  const parsed = bottleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const CELLAR_ACTIVITY_LABELS: Record<string, string> = {
  bottle_created: "ボトルを追加",
  bottle_updated: "ボトルを更新",
  bottle_photo_changed: "写真を変更",
  bottle_consumed: "開栓",
  bottle_restored: "開栓を取消",
  bottle_moved_in: "ボトルを移動",
  bottle_moved_out: "ボトルを移動",
  bottle_deleted: "ボトルを削除",
  member_joined: "参加",
  member_left: "退出",
  member_removed: "メンバーを外した",
  owner_transferred: "オーナーを変更",
  cellar_renamed: "名前を変更",
  invite_created: "招待リンクを作成",
  invite_revoked: "招待を無効化",
};

let lastLocalWriteAt = 0;

export function markCellarLocalWrite(): void {
  lastLocalWriteAt = Date.now();
}

export function isRecentLocalCellarWrite(windowMs = 3000): boolean {
  return Date.now() - lastLocalWriteAt < windowMs;
}
