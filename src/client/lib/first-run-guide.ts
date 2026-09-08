import { GUIDE_PREF_KEY, type GuideStatus } from "@/shared/constants.ts";

export const GUIDE_STEPS = ["invite", "home-record", "practice", "done"] as const;

export type GuideStep = (typeof GUIDE_STEPS)[number];

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

export function nextGuideStep(step: GuideStep, action: "continue" | "skip"): GuideStep | null {
  if (action === "skip") {
    return null;
  }
  if (step === "invite") {
    return "home-record";
  }
  if (step === "home-record") {
    return "practice";
  }
  if (step === "practice") {
    return "done";
  }
  return null;
}
