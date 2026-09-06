type AgentDebugPayload = {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, string | number | boolean | null>;
  timestamp: number;
};

export function agentDebug(payload: AgentDebugPayload): void {
  void fetch("/__agent-debug-log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
