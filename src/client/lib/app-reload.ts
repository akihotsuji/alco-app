import { APP_RELOAD_COOLDOWN_MS, APP_RELOAD_STORAGE_KEY } from "@/client/lib/boot.ts";
import { isLeaveGuardRegistered } from "@/client/lib/leave-guard-state.ts";

export type ReloadReason = "sw-update" | "asset" | "user";

export type ReloadDecision = "reload" | "skip-loop" | "notify-dirty";

export type ReloadRecord = {
  reason: ReloadReason;
  at: number;
};

export function parseReloadRecord(raw: string | null): ReloadRecord | null {
  if (!raw) {
    return null;
  }
  const sep = raw.lastIndexOf(":");
  if (sep <= 0) {
    return null;
  }
  const reason = raw.slice(0, sep);
  const at = Number(raw.slice(sep + 1));
  if ((reason !== "sw-update" && reason !== "asset" && reason !== "user") || !Number.isFinite(at)) {
    return null;
  }
  return { reason, at };
}

export function serializeReloadRecord(record: ReloadRecord): string {
  return `${record.reason}:${record.at}`;
}

export function decideAppReload(input: {
  reason: ReloadReason;
  last: ReloadRecord | null;
  now: number;
  cooldownMs: number;
  leaveGuardActive: boolean;
}): ReloadDecision {
  if (input.reason === "sw-update" && input.leaveGuardActive) {
    return "notify-dirty";
  }
  if (input.reason === "user") {
    return "reload";
  }
  if (input.last && input.now - input.last.at < input.cooldownMs) {
    return "skip-loop";
  }
  return "reload";
}

export function readReloadRecord(storage: Pick<Storage, "getItem">): ReloadRecord | null {
  return parseReloadRecord(storage.getItem(APP_RELOAD_STORAGE_KEY));
}

export function writeReloadRecord(storage: Pick<Storage, "setItem">, record: ReloadRecord): void {
  storage.setItem(APP_RELOAD_STORAGE_KEY, serializeReloadRecord(record));
}

export function clearReloadGuard(storage: Pick<Storage, "removeItem"> = sessionStorage): void {
  storage.removeItem(APP_RELOAD_STORAGE_KEY);
}

type ReloadDeps = {
  now?: () => number;
  storage?: Pick<Storage, "getItem" | "setItem">;
  leaveGuardActive?: () => boolean;
  reload?: () => void;
  notifyDirty?: () => void;
  cooldownMs?: number;
};

export function requestAppReload(reason: ReloadReason, deps: ReloadDeps = {}): ReloadDecision {
  const now = deps.now?.() ?? Date.now();
  const storage = deps.storage ?? sessionStorage;
  const decision = decideAppReload({
    reason,
    last: readReloadRecord(storage),
    now,
    cooldownMs: deps.cooldownMs ?? APP_RELOAD_COOLDOWN_MS,
    leaveGuardActive: deps.leaveGuardActive?.() ?? isLeaveGuardRegistered(),
  });
  if (decision === "notify-dirty") {
    deps.notifyDirty?.();
    return decision;
  }
  if (decision === "skip-loop") {
    return decision;
  }
  writeReloadRecord(storage, { reason, at: now });
  (deps.reload ?? (() => window.location.reload()))();
  return decision;
}
