type AgentDebugEntry = {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
};

export function agentDebugLog(entry: Omit<AgentDebugEntry, "timestamp">): void {
  if (!import.meta.env.DEV) {
    return;
  }
  navigator.sendBeacon(
    "/__agent-debug-log",
    JSON.stringify({ ...entry, timestamp: Date.now() } satisfies AgentDebugEntry),
  );
}
