import { stderr, stdin, stdout } from "node:process";

type WorkflowRun = {
  name?: unknown;
  conclusion?: unknown;
};

type RunsPayload = {
  workflow_runs?: unknown;
};

export function ciSucceededOnCommit(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const runs = (payload as RunsPayload).workflow_runs;
  if (!Array.isArray(runs)) {
    return false;
  }
  return runs.some((run) => {
    if (!run || typeof run !== "object") {
      return false;
    }
    const candidate = run as WorkflowRun;
    return candidate.name === "CI" && candidate.conclusion === "success";
  });
}

const isCli = process.argv[1] !== undefined && import.meta.filename === process.argv[1];

if (isCli) {
  const chunks: string[] = [];
  stdin.setEncoding("utf8");
  stdin.on("data", (chunk) => {
    chunks.push(String(chunk));
  });
  stdin.on("end", () => {
    const raw = chunks.join("");
    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      stderr.write("CI run list is not valid JSON.\n");
      process.exit(1);
    }
    if (!ciSucceededOnCommit(payload)) {
      stderr.write("CI has not succeeded for this commit.\n");
      process.exit(1);
    }
    stdout.write("CI succeeded for this commit.\n");
  });
}
