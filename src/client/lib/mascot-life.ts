import { MASCOT_LIFE_MS } from "@/shared/constants.ts";

export type MascotLifeAction = "blink" | "wink" | "gaze" | "react" | null;

export type MascotLifeState = {
  action: MascotLifeAction;
  gaze: "target" | "user" | "none";
  lastTapAt: number | null;
};

export function initialMascotLifeState(): MascotLifeState {
  return { action: null, gaze: "none", lastTapAt: null };
}

export function idleBlinkDelayMs(random = Math.random): number {
  const span = MASCOT_LIFE_MS.idleBlinkMax - MASCOT_LIFE_MS.idleBlinkMin;
  return MASCOT_LIFE_MS.idleBlinkMin + Math.round(random() * span);
}

export function canStartMascotTap(state: MascotLifeState, now: number): boolean {
  if (state.lastTapAt === null) {
    return true;
  }
  return now - state.lastTapAt >= MASCOT_LIFE_MS.tapCooldown;
}

export function startMascotTap(state: MascotLifeState, now: number): MascotLifeState | null {
  if (!canStartMascotTap(state, now)) {
    return null;
  }
  return { ...state, action: "wink", lastTapAt: now };
}

export function mascotActionDuration(action: Exclude<MascotLifeAction, null>): number {
  if (action === "blink") {
    return MASCOT_LIFE_MS.blink;
  }
  if (action === "wink") {
    return MASCOT_LIFE_MS.wink;
  }
  if (action === "gaze") {
    return MASCOT_LIFE_MS.gaze;
  }
  return MASCOT_LIFE_MS.react;
}

let activeLifeId: string | null = null;

export function claimMascotLife(id: string): boolean {
  if (activeLifeId && activeLifeId !== id) {
    return false;
  }
  activeLifeId = id;
  return true;
}

export function releaseMascotLife(id: string): void {
  if (activeLifeId === id) {
    activeLifeId = null;
  }
}

export function activeMascotLifeId(): string | null {
  return activeLifeId;
}
