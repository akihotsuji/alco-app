import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ZodType } from "zod";
import { readClientBuildId } from "@/client/lib/app-version.ts";
import { bottlesResponseSchema } from "@/shared/bottles.ts";
import { cellarsResponseSchema } from "@/shared/cellars.ts";
import { drinkLogSummarySchema } from "@/shared/drink-logs.ts";
import { myDrinksResponseSchema } from "@/shared/my-drinks.ts";
import { tastingNotesResponseSchema } from "@/shared/tasting-notes.ts";

/**
 * 一覧の再表示用。セッション・メール・写真本文・友達のデータは保存しない。
 * 起動時に戻した値は無効化しておき、画面が開いたら取り直す（楽観的更新ではない）。
 * 正本は spec/features/performance.md。
 */
export const QUERY_PERSIST_STORAGE_KEY = "alco.query-cache.v1";
export const QUERY_PERSIST_VERSION = 1;
export const QUERY_PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const QUERY_PERSIST_MAX_ENTRIES = 24;
export const QUERY_PERSIST_MAX_BYTES = 1_000_000;
export const QUERY_PERSIST_WRITE_DELAY_MS = 1000;

const PERSIST_VERSION = QUERY_PERSIST_VERSION;

type PersistKind = "summary" | "my-drinks" | "cellars" | "bottles" | "notes";

const schemas: Record<PersistKind, ZodType> = {
  summary: drinkLogSummarySchema,
  "my-drinks": myDrinksResponseSchema,
  cellars: cellarsResponseSchema,
  bottles: bottlesResponseSchema,
  notes: tastingNotesResponseSchema,
};

export type PersistStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type PersistEvents = {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
};

export type PersistQuerySnapshot = {
  queryKey: QueryKey;
  status: string;
  dataUpdatedAt: number;
  data: unknown;
};

export type PersistEntry = {
  key: QueryKey;
  data: unknown;
  updatedAt: number;
};

type PersistEnvelope = {
  userId: string;
  buildId: string;
  savedAt: number;
  entries: PersistEntry[];
};

/** clear のたびに増やす。それより前に予約した書き込みは捨てる。 */
let epoch = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSearchText(filter: Record<string, unknown>): boolean {
  return typeof filter.q === "string" && filter.q.trim() !== "";
}

export function classifyQueryKey(key: QueryKey): PersistKind | null {
  const head = key[0];
  if (head === "drink-log-summaries" && key.length === 2 && isRecord(key[1])) {
    const period = key[1].period;
    const date = key[1].date;
    if (
      (period === "day" || period === "week" || period === "month") &&
      typeof date === "string" &&
      date.trim() !== ""
    ) {
      return "summary";
    }
    return null;
  }
  if (head === "my-drinks" && key.length === 1) {
    return "my-drinks";
  }
  if (head === "cellars" && key.length === 2 && key[1] === "list") {
    return "cellars";
  }
  if (head === "bottles" && key.length === 2 && isRecord(key[1]) && !hasSearchText(key[1])) {
    return "bottles";
  }
  if (
    head === "tasting-notes" &&
    key.length === 2 &&
    isRecord(key[1]) &&
    !hasSearchText(key[1]) &&
    (key[1].bottleId === undefined || key[1].bottleId === null)
  ) {
    return "notes";
  }
  return null;
}

function isInfiniteData(value: unknown): value is { pages: unknown[] } {
  return isRecord(value) && Array.isArray(value.pages);
}

/** スキーマに合う形だけ残す。無限一覧は先頭ページだけ。合わなければ undefined */
export function normalizePersistData(kind: PersistKind, data: unknown): unknown | undefined {
  const schema = schemas[kind];
  if ((kind === "bottles" || kind === "notes") && isInfiniteData(data)) {
    const first = data.pages[0];
    const parsed = schema.safeParse(first);
    if (!parsed.success) {
      return undefined;
    }
    return { pages: [parsed.data] };
  }
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

function materialize(data: unknown): unknown {
  if (isInfiniteData(data)) {
    return { pages: data.pages, pageParams: data.pages.map(() => undefined) };
  }
  return data;
}

function withinAge(updatedAt: number, now: number): boolean {
  return updatedAt > 0 && now >= updatedAt && now - updatedAt <= QUERY_PERSIST_MAX_AGE_MS;
}

export function collectPersistEntries(
  queries: readonly PersistQuerySnapshot[],
  now: number,
  envelope: { userId: string; buildId: string },
): PersistEntry[] {
  const selected: PersistEntry[] = [];
  for (const query of queries) {
    if (query.status !== "success" || !withinAge(query.dataUpdatedAt, now)) {
      continue;
    }
    const kind = classifyQueryKey(query.queryKey);
    if (!kind) {
      continue;
    }
    const data = normalizePersistData(kind, query.data);
    if (data === undefined) {
      continue;
    }
    selected.push({ key: [...query.queryKey], data, updatedAt: query.dataUpdatedAt });
  }
  selected.sort((a, b) => b.updatedAt - a.updatedAt);
  const kept: PersistEntry[] = [];
  for (const entry of selected) {
    if (kept.length >= QUERY_PERSIST_MAX_ENTRIES) {
      break;
    }
    const raw = encodePersistPayload({ ...envelope, savedAt: now, entries: [...kept, entry] });
    if (raw.length > QUERY_PERSIST_MAX_BYTES) {
      continue;
    }
    kept.push(entry);
  }
  return kept;
}

export function encodePersistPayload(envelope: PersistEnvelope): string {
  return JSON.stringify({
    v: PERSIST_VERSION,
    buildId: envelope.buildId,
    userId: envelope.userId,
    savedAt: envelope.savedAt,
    entries: envelope.entries.map((entry) => ({
      key: entry.key,
      data: entry.data,
      updatedAt: entry.updatedAt,
    })),
  });
}

export type DecodedPersist =
  | { ok: true; entries: PersistEntry[] }
  | { ok: false; reason: "malformed" | "mismatch" };

export function decodePersistPayload(
  raw: string,
  expected: { userId: string; buildId: string; now: number },
): DecodedPersist {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    !isRecord(parsed) ||
    parsed.v !== PERSIST_VERSION ||
    parsed.buildId !== expected.buildId ||
    parsed.userId !== expected.userId ||
    typeof parsed.savedAt !== "number" ||
    !withinAge(parsed.savedAt, expected.now) ||
    !Array.isArray(parsed.entries)
  ) {
    return { ok: false, reason: "mismatch" };
  }
  const entries: PersistEntry[] = [];
  for (const item of parsed.entries) {
    if (!isRecord(item) || !Array.isArray(item.key) || typeof item.updatedAt !== "number") {
      continue;
    }
    if (!withinAge(item.updatedAt, expected.now)) {
      continue;
    }
    const key = item.key as QueryKey;
    const kind = classifyQueryKey(key);
    if (!kind) {
      continue;
    }
    const data = normalizePersistData(kind, item.data);
    if (data === undefined) {
      continue;
    }
    entries.push({ key, data, updatedAt: item.updatedAt });
  }
  return { ok: true, entries };
}

function browserStorage(): PersistStorage | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

function snapshotQueries(queryClient: QueryClient): PersistQuerySnapshot[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .map((query) => ({
      queryKey: query.queryKey,
      status: query.state.status,
      dataUpdatedAt: query.state.dataUpdatedAt,
      data: query.state.data,
    }));
}

export function restorePersistedQueries(
  queryClient: QueryClient,
  userId: string,
  options: { storage?: PersistStorage; buildId?: string; now?: number } = {},
): number {
  const storage = options.storage ?? browserStorage();
  if (!storage || userId.trim() === "") {
    return 0;
  }
  let raw: string | null;
  try {
    raw = storage.getItem(QUERY_PERSIST_STORAGE_KEY);
  } catch {
    return 0;
  }
  if (raw === null) {
    return 0;
  }
  const decoded = decodePersistPayload(raw, {
    userId,
    buildId: options.buildId ?? readClientBuildId(),
    now: options.now ?? Date.now(),
  });
  if (!decoded.ok) {
    try {
      storage.removeItem(QUERY_PERSIST_STORAGE_KEY);
    } catch {
      // 読めないストレージには書き戻さない
    }
    return 0;
  }
  let restored = 0;
  for (const entry of decoded.entries) {
    if (queryClient.getQueryState(entry.key) !== undefined) {
      continue;
    }
    queryClient.setQueryData(entry.key, materialize(entry.data), { updatedAt: entry.updatedAt });
    queryClient.invalidateQueries({ queryKey: entry.key, exact: true, refetchType: "none" });
    restored += 1;
  }
  return restored;
}

export type StartQueryPersistenceOptions = {
  storage?: PersistStorage;
  events?: PersistEvents | null;
  buildId?: string;
  now?: () => number;
  delayMs?: number;
  hidden?: () => boolean;
};

function documentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/**
 * 一覧が更新されたら少し待ってから書き、画面を離れるときは待たずに書く。
 * 戻り値は購読解除。ストレージの中身は消さない（消すのは clearPersistedQueries）。
 */
export function startQueryPersistence(
  queryClient: QueryClient,
  userId: string,
  options: StartQueryPersistenceOptions = {},
): () => void {
  const storage = options.storage ?? browserStorage();
  if (!storage || userId.trim() === "") {
    return () => {};
  }
  const buildId = options.buildId ?? readClientBuildId();
  const now = options.now ?? (() => Date.now());
  const delayMs = options.delayMs ?? QUERY_PERSIST_WRITE_DELAY_MS;
  const events = options.events === undefined ? defaultEvents() : options.events;
  const myEpoch = epoch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  let stopped = false;

  const write = () => {
    if (stopped || myEpoch !== epoch) {
      return;
    }
    dirty = false;
    const entries = collectPersistEntries(snapshotQueries(queryClient), now(), { userId, buildId });
    const raw = encodePersistPayload({ userId, buildId, savedAt: now(), entries });
    try {
      storage.setItem(QUERY_PERSIST_STORAGE_KEY, raw);
    } catch {
      try {
        storage.removeItem(QUERY_PERSIST_STORAGE_KEY);
      } catch {
        // 容量超過のあともう一度失敗しても起動は続ける
      }
      stopped = true;
    }
  };

  const schedule = () => {
    if (stopped || myEpoch !== epoch) {
      return;
    }
    dirty = true;
    if (timer !== undefined) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      if (dirty) {
        write();
      }
    }, delayMs);
  };

  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (dirty) {
      write();
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!classifyQueryKey(event.query.queryKey)) {
      return;
    }
    schedule();
  });

  const onPageHide = () => {
    flush();
  };
  const onVisibility = () => {
    const hidden = options.hidden ? options.hidden() : documentHidden();
    if (hidden) {
      flush();
    }
  };
  const onStorage = (event: Event) => {
    if (!("key" in event) || !("newValue" in event)) {
      return;
    }
    const storageEvent = event as StorageEvent;
    if (storageEvent.key === QUERY_PERSIST_STORAGE_KEY && storageEvent.newValue === null) {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    }
  };

  events?.addEventListener("pagehide", onPageHide);
  events?.addEventListener("visibilitychange", onVisibility);
  events?.addEventListener("storage", onStorage);

  return () => {
    stopped = true;
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    unsubscribe();
    events?.removeEventListener("pagehide", onPageHide);
    events?.removeEventListener("visibilitychange", onVisibility);
    events?.removeEventListener("storage", onStorage);
  };
}

function defaultEvents(): PersistEvents | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}

/** ログアウト・削除・別タブのサインアウトで呼ぶ。以降の予約書き込みは捨てる。 */
export function clearPersistedQueries(storage?: PersistStorage): void {
  epoch += 1;
  const target = storage ?? browserStorage();
  if (!target) {
    return;
  }
  try {
    target.removeItem(QUERY_PERSIST_STORAGE_KEY);
  } catch {
    // すでに触れない
  }
}
