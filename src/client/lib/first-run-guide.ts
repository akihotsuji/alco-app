import { GUIDE_PREF_KEY, type GuideStatus } from "@/shared/constants.ts";

export const GUIDE_TOURS = ["record", "cellar", "notes"] as const;

export type GuideTour = (typeof GUIDE_TOURS)[number];

export const GUIDE_TOUR_LABELS: Record<GuideTour, string> = {
  record: "記録",
  cellar: "セラー",
  notes: "ノート",
};

export const GUIDE_STEPS = [
  "invite",
  "home-record",
  "practice-volume",
  "practice-save",
  "done",
  "cellar-add",
  "cellar-type",
  "cellar-save",
  "cellar-done",
  "notes-create",
  "notes-rating",
  "notes-save",
  "notes-done",
] as const;

export type GuideStep = (typeof GUIDE_STEPS)[number];

export const GUIDE_TOUR_STEPS: Record<GuideTour, readonly GuideStep[]> = {
  record: ["home-record", "practice-volume", "practice-save", "done"],
  cellar: ["cellar-add", "cellar-type", "cellar-save", "cellar-done"],
  notes: ["notes-create", "notes-rating", "notes-save", "notes-done"],
};

export const GUIDE_PRACTICE_STEPS = new Set<GuideStep>([
  "practice-volume",
  "practice-save",
  "cellar-type",
  "cellar-save",
  "notes-rating",
  "notes-save",
]);

export const GUIDE_DONE_STEPS = new Set<GuideStep>(["done", "cellar-done", "notes-done"]);

export function isGuidePracticeStep(step: GuideStep | "off"): boolean {
  return step !== "off" && GUIDE_PRACTICE_STEPS.has(step);
}

export function guideTourOf(step: GuideStep): GuideTour | null {
  for (const tour of GUIDE_TOURS) {
    if ((GUIDE_TOUR_STEPS[tour] as readonly GuideStep[]).includes(step)) {
      return tour;
    }
  }
  return null;
}

export function guideStartStep(tour: GuideTour): GuideStep {
  if (tour === "cellar") {
    return "cellar-add";
  }
  if (tour === "notes") {
    return "notes-create";
  }
  return "home-record";
}

export function guideTourPath(tour: GuideTour): string {
  if (tour === "cellar") {
    return "/cellar";
  }
  if (tour === "notes") {
    return "/notes";
  }
  return "/";
}

export type GuideRecord = {
  userId: string;
  status: GuideStatus;
  cellarHintSeen: boolean;
  notesHintSeen: boolean;
};

export type GuideActivity = {
  hasLogs: boolean;
  hasMyDrinks: boolean;
  hasBottles: boolean;
  hasNotes: boolean;
};

export function emptyGuideRecord(userId: string): GuideRecord {
  return {
    userId,
    status: "unset",
    cellarHintSeen: false,
    notesHintSeen: false,
  };
}

export function hasExistingGuideActivity(activity: GuideActivity): boolean {
  return activity.hasLogs || activity.hasMyDrinks || activity.hasBottles || activity.hasNotes;
}

export function shouldAutoOfferGuide(record: GuideRecord, activity: GuideActivity): boolean {
  if (record.status !== "unset") {
    return false;
  }
  return !hasExistingGuideActivity(activity);
}

export function parseGuideRecord(raw: string | null, userId: string): GuideRecord {
  if (!raw) {
    return emptyGuideRecord(userId);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return emptyGuideRecord(userId);
    }
    const record = parsed as Partial<GuideRecord>;
    if (record.userId !== userId) {
      return emptyGuideRecord(userId);
    }
    const status = record.status;
    return {
      userId,
      status:
        status === "skipped" || status === "completed" || status === "existing" ? status : "unset",
      cellarHintSeen: record.cellarHintSeen === true,
      notesHintSeen: record.notesHintSeen === true,
    };
  } catch {
    return emptyGuideRecord(userId);
  }
}

export function peekStoredGuideRecord(): GuideRecord | null {
  try {
    const raw = localStorage.getItem(GUIDE_PREF_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("userId" in parsed)) {
      return null;
    }
    const userId = (parsed as { userId: unknown }).userId;
    if (typeof userId !== "string" || userId.length === 0) {
      return null;
    }
    return parseGuideRecord(raw, userId);
  } catch {
    return null;
  }
}

export function readGuideRecord(userId: string): GuideRecord {
  try {
    return parseGuideRecord(localStorage.getItem(GUIDE_PREF_KEY), userId);
  } catch {
    return emptyGuideRecord(userId);
  }
}

export function writeGuideRecord(record: GuideRecord): void {
  try {
    localStorage.setItem(GUIDE_PREF_KEY, JSON.stringify(record));
  } catch {
    // プライベートモードでは記憶できない。自動表示が繰り返されても実データは変えない
  }
}

export function markGuideStatus(
  userId: string,
  status: Exclude<GuideStatus, "unset">,
): GuideRecord {
  const next = { ...readGuideRecord(userId), userId, status };
  writeGuideRecord(next);
  return next;
}

export function markGuideHintSeen(
  userId: string,
  hint: "cellarHintSeen" | "notesHintSeen",
): GuideRecord {
  const next = { ...readGuideRecord(userId), userId, [hint]: true };
  writeGuideRecord(next);
  return next;
}

export type GuideLaunch = {
  status: GuideStatus;
  step: GuideStep | "off";
};

export function hasExistingUserData(input: {
  todayLogCount: number;
  weekLogCount: number;
  myDrinkCount: number;
  bottleCount: number;
  noteCount: number;
}): boolean {
  return hasExistingGuideActivity({
    hasLogs: input.todayLogCount > 0 || input.weekLogCount > 0,
    hasMyDrinks: input.myDrinkCount > 0,
    hasBottles: input.bottleCount > 0,
    hasNotes: input.noteCount > 0,
  });
}

export function resolveInitialGuide(input: {
  stored: GuideStatus;
  hasExistingData: boolean;
  replayRequested: boolean;
}): GuideLaunch {
  if (input.replayRequested) {
    return { status: input.stored, step: "home-record" };
  }
  if (input.stored !== "unset") {
    return { status: input.stored, step: "off" };
  }
  if (input.hasExistingData) {
    return { status: "existing", step: "off" };
  }
  return { status: "unset", step: "invite" };
}

export function readGuidePref(userId: string): GuideStatus {
  return readGuideRecord(userId).status;
}

export function writeGuidePref(userId: string, status: Exclude<GuideStatus, "unset">): GuideRecord {
  return markGuideStatus(userId, status);
}

export function guideSpotlightSteps(tour: GuideTour): readonly GuideStep[] {
  return GUIDE_TOUR_STEPS[tour].filter((step) => !GUIDE_DONE_STEPS.has(step));
}

export function guideStepProgress(step: GuideStep): { current: number; total: number } | null {
  const tour = guideTourOf(step);
  if (!tour) {
    return null;
  }
  const spots = guideSpotlightSteps(tour);
  const index = spots.indexOf(step);
  if (index < 0) {
    return null;
  }
  return { current: index + 1, total: spots.length };
}

export type GuideSpotlightConfig = {
  target: string;
  message: string;
};

export function guideSpotlight(step: GuideStep): GuideSpotlightConfig | null {
  if (step === "home-record") {
    return { target: '[data-guide-target="record"]', message: "飲んだ量は、ここから残せます" };
  }
  if (step === "practice-volume") {
    return {
      target: '[data-guide-target="volume"]',
      message: "量を選ぶ。写真はなくても大丈夫です",
    };
  }
  if (step === "practice-save") {
    return {
      target: '[data-guide-target="save"]',
      message: "ここを押すと練習として保存されます。記録には残りません",
    };
  }
  if (step === "cellar-add") {
    return {
      target: '[data-guide-target="cellar-add"]',
      message: "持っているボトルを、ここに並べて管理します",
    };
  }
  if (step === "cellar-type") {
    return {
      target: '[data-guide-target="drink-type"]',
      message: "種類を選ぶ。写真があれば色や泡から推測します",
    };
  }
  if (step === "cellar-save") {
    return {
      target: '[data-guide-target="save"]',
      message: "練習として並べる。棚には残りません",
    };
  }
  if (step === "notes-create") {
    return {
      target: '[data-guide-target="notes-create"]',
      message: "味や感想は、ノートに残します",
    };
  }
  if (step === "notes-rating") {
    return {
      target: '[data-guide-target="rating"]',
      message: "星で評価する。写真はなくても大丈夫です",
    };
  }
  if (step === "notes-save") {
    return {
      target: '[data-guide-target="save"]',
      message: "練習として保存する。ノートには残りません",
    };
  }
  return null;
}

export function guideDoneCopy(step: GuideStep): { title: string; detail: string | null } {
  if (step === "cellar-done") {
    return { title: "セラーの基本はこれだけです", detail: null };
  }
  if (step === "notes-done") {
    return { title: "ノートの基本はこれだけです", detail: null };
  }
  return {
    title: "記録の基本はこれだけです",
    detail: "セラーやノートは、設定の「使い方を見る」から試せます",
  };
}

export function nextGuideStep(step: GuideStep, action: "continue" | "skip"): GuideStep | null {
  if (action === "skip") {
    return null;
  }
  if (step === "invite") {
    return "home-record";
  }
  const tour = guideTourOf(step);
  if (!tour) {
    return null;
  }
  const steps = GUIDE_TOUR_STEPS[tour];
  const index = steps.indexOf(step);
  if (index < 0 || index >= steps.length - 1) {
    return null;
  }
  return steps[index + 1] ?? null;
}
