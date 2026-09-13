import type { Page } from "@playwright/test";
import { DEMO_BOTTLES, DEMO_LOGS, DEMO_NOTES, demoDrinkTypeId } from "./demo-catalog.ts";

const RUN_META = {
  provider: "gemini",
  remainingToday: 9990,
  profile: "gemini-3.7-flash",
  modelId: "google/gemini-3.7-flash",
  durationMs: 640,
  usage: {
    inputTokens: 120,
    outputTokens: 80,
    thinkingTokens: 0,
    searchCount: 0,
  },
  sources: [],
  searchUsed: false,
} as const;

/**
 * ローカルでは外部 AI を切っているため、認識 API だけをデモ応答に差し替える。
 * 画面は本番と同じフォーム。結果を捏造した別 UI は出さない。
 */
export async function installRecognizeMocks(page: Page): Promise<void> {
  let bottleIndex = 0;
  let logIndex = 0;
  let noteIndex = 0;

  await page.route("**/api/drink-logs/recognize/lookup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fields: {},
        matched: false,
        ...RUN_META,
      }),
    });
  });

  await page.route("**/api/drink-logs/recognize", async (route) => {
    if (route.request().url().includes("/lookup")) {
      await route.fallback();
      return;
    }
    const log = DEMO_LOGS[Math.min(logIndex, DEMO_LOGS.length - 1)]!;
    logIndex += 1;
    const volumeMl = log.drinkTypeLabel === "ウイスキー" ? 30 : log.drinkTypeLabel === "日本酒" ? 180 : 150;
    const abvPercent = log.drinkTypeLabel === "ウイスキー" ? 40 : log.drinkTypeLabel === "日本酒" ? 15 : 12;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fields: {
          drinkName: { value: log.name, confidence: 0.93 },
          drinkType: { value: demoDrinkTypeId(log.drinkTypeLabel), confidence: 0.91 },
          volumeMl: { value: volumeMl, confidence: 0.84 },
          abvPercent: { value: abvPercent, confidence: 0.82 },
        },
        lookupSuggested: false,
        ...RUN_META,
      }),
    });
  });

  await page.route("**/api/bottles/recognize", async (route) => {
    const bottle = DEMO_BOTTLES[Math.min(bottleIndex, DEMO_BOTTLES.length - 1)]!;
    bottleIndex += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fields: {
          name: { value: bottle.name, confidence: 0.93 },
          producer: { value: bottle.producer, confidence: 0.9 },
          origin: { value: bottle.origin, confidence: 0.88 },
          ...(bottle.variety
            ? { variety: { value: bottle.variety, confidence: 0.86 } }
            : {}),
          ...(bottle.vintage
            ? { vintage: { value: Number(bottle.vintage), confidence: 0.9 } }
            : {}),
          drinkType: { value: demoDrinkTypeId(bottle.drinkTypeLabel), confidence: 0.92 },
        },
        provider: "gemini",
        remainingToday: 9990,
      }),
    });
  });

  await page.route("**/api/tasting-notes/recognize", async (route) => {
    const note = DEMO_NOTES[Math.min(noteIndex, DEMO_NOTES.length - 1)]!;
    noteIndex += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fields: {
          drinkName: { value: note.name, confidence: 0.92 },
          drinkType: { value: demoDrinkTypeId(note.drinkTypeLabel), confidence: 0.9 },
        },
        provider: "gemini",
        remainingToday: 9990,
      }),
    });
  });
}
