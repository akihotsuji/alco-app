import { afterEach, describe, expect, it, vi } from "vitest";
import { findBottleInListCache } from "@/client/lib/bottle-list-cache.ts";
import { createQueryClient } from "@/client/lib/query-client.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { emptyCountsByType } from "@/shared/bottles.ts";
import { TOKYO_TIME_ZONE } from "@/shared/tokyo-date.ts";
import {
  clearPersistedQueries,
  collectPersistEntries,
  decodePersistPayload,
  encodePersistPayload,
  normalizePersistData,
  type PersistEntry,
  type PersistEvents,
  type PersistQuerySnapshot,
  type PersistStorage,
  QUERY_PERSIST_MAX_AGE_MS,
  QUERY_PERSIST_MAX_BYTES,
  QUERY_PERSIST_STORAGE_KEY,
  restorePersistedQueries,
  startQueryPersistence,
} from "./query-persist.ts";

const USER = "user-1";
const BUILD = "build-1";
const NOW = 1_700_000_000_000;

function storage(): PersistStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function summary(period: "day" | "week" = "day") {
  return {
    period,
    from: "2026-11-17",
    to: "2026-11-17",
    timezone: TOKYO_TIME_ZONE,
    totalCount: 1,
    totalAlcoholG: 10,
    dryDayCount: 0,
    days: [],
  };
}

function bottles(name = "Vosne") {
  return {
    items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name,
        drinkType: "wine_red",
        producer: null,
        origin: null,
        variety: null,
        vintage: null,
        purchasedOn: null,
        priceJpy: null,
        shop: null,
        storedOn: null,
        storage: null,
        memo: null,
        status: "sealed",
        openedAt: null,
        openedOn: null,
        finishedAt: null,
        finishedOn: null,
        consumedAt: null,
        consumedOn: null,
        thumbPhotoId: null,
        thumbPhotoKind: null,
        cellarId: "cellar-1",
        version: 1,
        createdByName: null,
        updatedByName: null,
        createdAt: "2026-11-17T00:00:00.000Z",
        updatedAt: "2026-11-17T00:00:00.000Z",
      },
    ],
    nextCursor: null,
    totalCount: 1,
    countsByType: emptyCountsByType(),
  };
}

function notes() {
  return { items: [], nextCursor: null, totalCount: 0 };
}

function snap(
  queryKey: PersistQuerySnapshot["queryKey"],
  data: unknown,
  updatedAt = NOW,
): PersistQuerySnapshot {
  return { queryKey, status: "success", dataUpdatedAt: updatedAt, data };
}

const envelope = { userId: USER, buildId: BUILD };

describe("collectPersistEntries", () => {
  it("一覧だけを残し、詳細・検索・友達・メールは捨てる", () => {
    const entries = collectPersistEntries(
      [
        snap(queryKeys.drinkLogSummary("day", "2026-11-17"), summary()),
        snap(queryKeys.myDrinks, { items: [], nextCursor: null }),
        snap(queryKeys.cellarsList, { items: [] }),
        snap(queryKeys.bottlesList({ view: "cellar", limit: 8 }), bottles()),
        snap(queryKeys.tastingNotesList({ limit: 20 }), notes()),
        snap(queryKeys.me, { id: USER, email: "a@example.com" }),
        snap(queryKeys.bottle("11111111-1111-4111-8111-111111111111"), bottles().items[0]),
        snap(queryKeys.bottlesList({ view: "cellar", q: "秘密" }), bottles("検索結果")),
        snap(queryKeys.tastingNotesList({ bottleId: "b1", limit: 3 }), notes()),
        snap(queryKeys.socialFeed, { pages: [], pageParams: [] }),
        snap(queryKeys.friends, { items: [] }),
        snap(queryKeys.myDrink("22222222-2222-4222-8222-222222222222"), { id: "x" }),
        snap(["drink-logs", { date: "2026-11-17" }], { items: [{ memo: "日記" }] }),
      ],
      NOW,
      envelope,
    );
    expect(entries.map((entry) => entry.key[0])).toEqual([
      "drink-log-summaries",
      "my-drinks",
      "cellars",
      "bottles",
      "tasting-notes",
    ]);
    expect(JSON.stringify(entries)).not.toContain("a@example.com");
    expect(JSON.stringify(entries)).not.toContain("秘密");
    expect(JSON.stringify(entries)).not.toContain("日記");
  });

  it("無限一覧は先頭ページだけにし、スキーマ外は捨てる", () => {
    const page = bottles();
    const second = bottles("二ページ");
    const entries = collectPersistEntries(
      [
        snap(queryKeys.bottlesList({ view: "cellar", limit: 8 }), {
          pages: [page, second],
          pageParams: [undefined, "cursor-2"],
        }),
        snap(queryKeys.drinkLogSummary("week", "2026-11-17"), { period: "week" }),
      ],
      NOW,
      envelope,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.data).toEqual({ pages: [page] });
    expect(normalizePersistData("bottles", { pages: [{ items: [] }] })).toBeUndefined();
  });

  it("24 時間より古い取得と、失敗した query は保存しない", () => {
    const entries = collectPersistEntries(
      [
        snap(
          queryKeys.myDrinks,
          { items: [], nextCursor: null },
          NOW - QUERY_PERSIST_MAX_AGE_MS - 1,
        ),
        { ...snap(queryKeys.cellarsList, { items: [] }), status: "error" },
        { ...snap(queryKeys.cellarsList, undefined), status: "pending" },
      ],
      NOW,
      envelope,
    );
    expect(entries).toEqual([]);
  });

  it("新しい順に詰め、1 件が上限を超えたらその件だけ飛ばす", () => {
    const big = bottles("大きい");
    const huge = big.items[0];
    if (!huge) {
      throw new Error("fixture");
    }
    big.items[0] = { ...huge, name: "名".repeat(QUERY_PERSIST_MAX_BYTES) };
    const entries = collectPersistEntries(
      [
        snap(queryKeys.bottlesList({ view: "opened", limit: 12 }), big, NOW),
        snap(queryKeys.myDrinks, { items: [], nextCursor: null }, NOW - 10),
      ],
      NOW,
      envelope,
    );
    expect(entries.map((entry) => entry.key[0])).toEqual(["my-drinks"]);
  });
});

describe("decodePersistPayload", () => {
  function roundTrip(entries: PersistEntry[], savedAt = NOW) {
    return encodePersistPayload({ userId: USER, buildId: BUILD, savedAt, entries });
  }

  it("同じユーザー・同じ版のときだけ戻す", () => {
    const entries = collectPersistEntries(
      [snap(queryKeys.myDrinks, { items: [], nextCursor: null })],
      NOW,
      envelope,
    );
    const decoded = decodePersistPayload(roundTrip(entries), {
      userId: USER,
      buildId: BUILD,
      now: NOW,
    });
    expect(decoded).toEqual({ ok: true, entries });
  });

  it("別ユーザー・別ビルド・期限切れ・壊れた JSON は不一致として捨てる", () => {
    const entries = collectPersistEntries(
      [snap(queryKeys.myDrinks, { items: [], nextCursor: null })],
      NOW,
      envelope,
    );
    const raw = roundTrip(entries);
    expect(decodePersistPayload(raw, { userId: "other", buildId: BUILD, now: NOW }).ok).toBe(false);
    expect(decodePersistPayload(raw, { userId: USER, buildId: "next", now: NOW }).ok).toBe(false);
    expect(
      decodePersistPayload(raw, {
        userId: USER,
        buildId: BUILD,
        now: NOW + QUERY_PERSIST_MAX_AGE_MS + 1,
      }).ok,
    ).toBe(false);
    expect(decodePersistPayload("{", { userId: USER, buildId: BUILD, now: NOW }).ok).toBe(false);
  });

  it("改ざんされた中身は落とす", () => {
    const raw = JSON.stringify({
      v: 1,
      buildId: BUILD,
      userId: USER,
      savedAt: NOW,
      entries: [
        { key: queryKeys.me, data: { email: "a@example.com" }, updatedAt: NOW },
        { key: queryKeys.myDrinks, data: { items: [], nextCursor: null }, updatedAt: NOW },
      ],
    });
    const decoded = decodePersistPayload(raw, { userId: USER, buildId: BUILD, now: NOW });
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.entries).toHaveLength(1);
      expect(decoded.entries[0]?.key).toEqual(queryKeys.myDrinks);
    }
  });
});

describe("restorePersistedQueries", () => {
  it("空のキャッシュへ戻し、無効化して詳細の仮表示には使わせない", () => {
    const box = storage();
    const source = createQueryClient();
    const listKey = queryKeys.bottlesList({ view: "cellar", limit: 8 });
    source.setQueryData(listKey, bottles());
    const entries = collectPersistEntries(
      source
        .getQueryCache()
        .getAll()
        .map((query) => ({
          queryKey: query.queryKey,
          status: query.state.status,
          dataUpdatedAt: NOW,
          data: query.state.data,
        })),
      NOW,
      envelope,
    );
    box.setItem(
      QUERY_PERSIST_STORAGE_KEY,
      encodePersistPayload({ userId: USER, buildId: BUILD, savedAt: NOW, entries }),
    );

    const restored = createQueryClient();
    expect(
      restorePersistedQueries(restored, USER, { storage: box, buildId: BUILD, now: NOW }),
    ).toBe(1);
    expect(restored.getQueryState(listKey)?.status).toBe("success");
    expect(restored.getQueryState(listKey)?.isInvalidated).toBe(true);
    const bottleId = bottles().items[0]?.id;
    expect(bottleId).toBeTruthy();
    expect(findBottleInListCache(restored, bottleId ?? "")).toBeUndefined();
  });

  it("すでに取得が始まっている query は上書きしない", () => {
    const box = storage();
    const entries = collectPersistEntries(
      [snap(queryKeys.myDrinks, { items: [], nextCursor: null })],
      NOW,
      envelope,
    );
    box.setItem(
      QUERY_PERSIST_STORAGE_KEY,
      encodePersistPayload({ userId: USER, buildId: BUILD, savedAt: NOW, entries }),
    );
    const client = createQueryClient();
    client.setQueryData(queryKeys.myDrinks, { items: [{ id: "live" }], nextCursor: null });
    expect(restorePersistedQueries(client, USER, { storage: box, buildId: BUILD, now: NOW })).toBe(
      0,
    );
    expect(client.getQueryData(queryKeys.myDrinks)).toEqual({
      items: [{ id: "live" }],
      nextCursor: null,
    });
  });

  it("別ユーザーの保存は消して戻さない", () => {
    const box = storage();
    const entries = collectPersistEntries(
      [snap(queryKeys.myDrinks, { items: [], nextCursor: null })],
      NOW,
      envelope,
    );
    box.setItem(
      QUERY_PERSIST_STORAGE_KEY,
      encodePersistPayload({ userId: USER, buildId: BUILD, savedAt: NOW, entries }),
    );
    const client = createQueryClient();
    expect(
      restorePersistedQueries(client, "other", { storage: box, buildId: BUILD, now: NOW }),
    ).toBe(0);
    expect(box.map.has(QUERY_PERSIST_STORAGE_KEY)).toBe(false);
    expect(client.getQueryState(queryKeys.myDrinks)).toBeUndefined();
  });
});

describe("startQueryPersistence / clearPersistedQueries", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearPersistedQueries(storage());
  });

  function clocked(box: PersistStorage, events: PersistEvents | null = null) {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const client = createQueryClient();
    const stop = startQueryPersistence(client, USER, {
      storage: box,
      events,
      buildId: BUILD,
      now: () => Date.now(),
      delayMs: 1000,
    });
    return { client, stop };
  }

  it("一覧の更新を遅延して書き、画面を離れるときはすぐ書く", () => {
    const box = storage();
    const events = new EventTarget();
    const { client, stop } = clocked(box, events);
    client.setQueryData(queryKeys.myDrinks, { items: [], nextCursor: null });
    expect(box.map.has(QUERY_PERSIST_STORAGE_KEY)).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(box.getItem(QUERY_PERSIST_STORAGE_KEY)).toContain(USER);

    client.setQueryData(queryKeys.cellarsList, { items: [] });
    events.dispatchEvent(new Event("pagehide"));
    expect(box.getItem(QUERY_PERSIST_STORAGE_KEY)).toContain("cellars");
    stop();
  });

  it("友達の更新では書き直さない", () => {
    const box = storage();
    const { client } = clocked(box);
    client.setQueryData(queryKeys.friends, { items: [] });
    vi.advanceTimersByTime(1000);
    expect(box.map.has(QUERY_PERSIST_STORAGE_KEY)).toBe(false);
  });

  it("消去したあとの予約書き込みは保存を復活させない", () => {
    const box = storage();
    const { client } = clocked(box);
    client.setQueryData(queryKeys.myDrinks, { items: [], nextCursor: null });
    clearPersistedQueries(box);
    vi.advanceTimersByTime(1000);
    expect(box.map.has(QUERY_PERSIST_STORAGE_KEY)).toBe(false);
  });

  it("容量超過ではキーを消して例外にしない", () => {
    const box = storage();
    box.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const { client, stop } = clocked(box);
    client.setQueryData(queryKeys.myDrinks, { items: [], nextCursor: null });
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(box.map.has(QUERY_PERSIST_STORAGE_KEY)).toBe(false);
    stop();
  });

  it("他タブがキーを消したら、このタブは書き戻さない", () => {
    const box = storage();
    const events = new EventTarget();
    const { client } = clocked(box, events);
    const removed = new Event("storage");
    Object.assign(removed, { key: QUERY_PERSIST_STORAGE_KEY, newValue: null });
    events.dispatchEvent(removed);
    client.setQueryData(queryKeys.myDrinks, { items: [], nextCursor: null });
    vi.advanceTimersByTime(1000);
    expect(box.map.has(QUERY_PERSIST_STORAGE_KEY)).toBe(false);
  });
});
