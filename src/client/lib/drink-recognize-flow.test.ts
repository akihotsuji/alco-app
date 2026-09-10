import { describe, expect, it, vi } from "vitest";
import type { DrinkLookupResponse, DrinkRecognizeResponse } from "@/shared/drink-recognize.ts";
import {
  applyRecognizeToLogForm,
  countMarkedApplied,
  type DrinkRecognizeTouched,
} from "./drink-recognize.ts";
import { type DrinkRecognizeFlowDeps, runDrinkRecognizeFlow } from "./drink-recognize-flow.ts";
import { initialLogFormState, type LogFormState } from "./log-form.ts";

const NOW = new Date("2026-09-10T04:05:00.000Z");
const JPEG = new Blob(["x"], { type: "image/jpeg" });

const meta = {
  provider: "gemini",
  remainingToday: 29,
  profile: "gemini-3.5-flash-lite",
  modelId: "google/gemini-3.5-flash-lite",
  durationMs: 1800,
  usage: { inputTokens: null, outputTokens: null, thinkingTokens: null, searchCount: null },
  sources: [],
  searchUsed: false,
} satisfies Partial<DrinkRecognizeResponse>;

function extractResponse(over: Partial<DrinkRecognizeResponse> = {}): DrinkRecognizeResponse {
  return {
    fields: {
      drinkName: { value: "Dogliani Superiore", confidence: 0.9 },
      producer: { value: "Pecchenino", confidence: 0.9 },
      vintage: { value: 2020, confidence: 0.9 },
      drinkType: { value: "wine", confidence: 0.8 },
    },
    lookupSuggested: true,
    originCandidate: { value: "イタリア", evidence: "unverified_guess" },
    appellation: "Dogliani",
    ...meta,
    ...over,
  };
}

function lookupResponse(over: Partial<DrinkLookupResponse> = {}): DrinkLookupResponse {
  return {
    fields: {
      origin: { value: "イタリア", confidence: 0.8 },
      variety: { value: "Dolcetto", confidence: 0.8 },
    },
    matched: true,
    ...meta,
    searchUsed: true,
    ...over,
  };
}

type Harness = {
  deps: DrinkRecognizeFlowDeps;
  state: () => LogFormState;
  statuses: Array<[string, number]>;
  candidates: Array<string | null>;
  lookup: ReturnType<typeof vi.fn>;
};

function harness(
  recognize: () => Promise<DrinkRecognizeResponse>,
  lookup: () => Promise<DrinkLookupResponse>,
  options: { stale?: () => boolean; touched?: Partial<DrinkRecognizeTouched> } = {},
): Harness {
  let state = initialLogFormState(null, NOW);
  let marks: ReadonlySet<string> = new Set();
  const touched: DrinkRecognizeTouched = {
    drinkName: false,
    drinkType: false,
    volumeMl: false,
    abvPercent: false,
    producer: false,
    origin: false,
    variety: false,
    vintage: false,
    ...options.touched,
  };
  const statuses: Array<[string, number]> = [];
  const candidates: Array<string | null> = [];
  const lookupFn = vi.fn(lookup);
  return {
    deps: {
      recognize,
      lookup: lookupFn,
      snapshot: () => ({ state, marks }),
      touched,
      isStale: options.stale ?? (() => false),
      apply: (fields) => {
        const applied = applyRecognizeToLogForm({ state, fields, touched, marks });
        state = applied.next;
        marks = applied.marks;
        return { marked: countMarkedApplied(applied), applied: applied.applied.length };
      },
      onStatus: (status, count) => statuses.push([status, count]),
      onOriginCandidate: (value) => candidates.push(value),
    },
    state: () => state,
    statuses,
    candidates,
    lookup: lookupFn,
  };
}

describe("runDrinkRecognizeFlow", () => {
  it("抽出を先に反映し、照合中を経て国・品種を足した件数で終わる", async () => {
    const h = harness(
      () => Promise.resolve(extractResponse()),
      () => Promise.resolve(lookupResponse()),
    );
    await runDrinkRecognizeFlow(JPEG, h.deps);
    // drinkName / producer / vintage / drinkType の 4 件 → lookup で origin / variety を足して 6 件
    expect(h.statuses).toEqual([
      ["loading", 0],
      ["lookup", 4],
      ["success", 6],
    ]);
    expect(h.state()).toMatchObject({
      drinkName: "Dogliani Superiore",
      origin: "イタリア",
      variety: "Dolcetto",
    });
    expect(h.lookup).toHaveBeenCalledWith({
      drinkName: "Dogliani Superiore",
      producer: "Pecchenino",
      vintage: 2020,
      drinkType: "wine",
      appellation: "Dogliani",
    });
    expect(h.candidates).toEqual([null, "イタリア"]);
  });

  it("照合が失敗しても抽出結果は残り、結果文に戻る", async () => {
    const h = harness(
      () => Promise.resolve(extractResponse()),
      () => Promise.reject(new Error("upstream")),
    );
    await runDrinkRecognizeFlow(JPEG, h.deps);
    expect(h.statuses.at(-1)).toEqual(["success", 4]);
    expect(h.state().drinkName).toBe("Dogliani Superiore");
    expect(h.state().origin).toBe("");
  });

  it("照合が一致しなければ件数を足さない", async () => {
    const h = harness(
      () => Promise.resolve(extractResponse()),
      () => Promise.resolve(lookupResponse({ matched: false, fields: {} })),
    );
    await runDrinkRecognizeFlow(JPEG, h.deps);
    expect(h.statuses.at(-1)).toEqual(["success", 4]);
  });

  it("サーバーが照合を勧めなければ 1 リクエストで終わる", async () => {
    const h = harness(
      () =>
        Promise.resolve(extractResponse({ lookupSuggested: false, originCandidate: undefined })),
      () => Promise.resolve(lookupResponse()),
    );
    await runDrinkRecognizeFlow(JPEG, h.deps);
    expect(h.statuses).toEqual([
      ["loading", 0],
      ["success", 4],
    ]);
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it("国・品種をユーザーが触っていれば照合を呼ばない", async () => {
    const h = harness(
      () => Promise.resolve(extractResponse()),
      () => Promise.resolve(lookupResponse()),
      { touched: { origin: true, variety: true } },
    );
    await runDrinkRecognizeFlow(JPEG, h.deps);
    expect(h.lookup).not.toHaveBeenCalled();
    expect(h.statuses.at(-1)).toEqual(["success", 4]);
  });

  it("抽出の失敗は failure、項目なしは empty", async () => {
    const failed = harness(
      () => Promise.reject(new Error("offline")),
      () => Promise.resolve(lookupResponse()),
    );
    await runDrinkRecognizeFlow(JPEG, failed.deps);
    expect(failed.statuses.at(-1)).toEqual(["failure", 0]);

    const empty = harness(
      () => Promise.resolve(extractResponse({ fields: {}, lookupSuggested: false })),
      () => Promise.resolve(lookupResponse()),
    );
    await runDrinkRecognizeFlow(JPEG, empty.deps);
    expect(empty.statuses.at(-1)).toEqual(["empty", 0]);
    expect(empty.lookup).not.toHaveBeenCalled();
  });

  it("撮り直し後（stale）は何も反映しない", async () => {
    let stale = false;
    const h = harness(
      () => {
        stale = true;
        return Promise.resolve(extractResponse());
      },
      () => Promise.resolve(lookupResponse()),
      { stale: () => stale },
    );
    await runDrinkRecognizeFlow(JPEG, h.deps);
    expect(h.statuses).toEqual([["loading", 0]]);
    expect(h.state().drinkName).toBe("");
    expect(h.lookup).not.toHaveBeenCalled();
  });
});
