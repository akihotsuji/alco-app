import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../..");

describe("Cloud Agent environment.json", () => {
  const source = readFileSync(path.join(repoRoot, ".cursor/environment.json"), "utf8");
  const env = JSON.parse(source) as {
    install?: string;
    start?: string;
    terminals?: { command: string; name?: string }[];
    ports?: { port: number; name?: string }[];
  };

  it("start で .dev.vars とローカル migrate を行い、terminals で Vite を上げる", () => {
    expect(env.install).toContain("pnpm install");
    expect(env.start).toContain("scripts/cloud-agent-start.sh");
    expect(env.terminals?.some((terminal) => terminal.command.includes("vite"))).toBe(true);
    expect(
      env.terminals?.some((terminal) => terminal.command.includes("ensure-local-dev-user")),
    ).toBe(true);
    expect(env.ports?.some((port) => port.port === 5173)).toBe(true);
  });

  it("追跡ファイルに Auth secret の実値を置かない", () => {
    expect(source).not.toMatch(/BETTER_AUTH_SECRET\s*=\s*[0-9a-fA-F]{16,}/);
    expect(source).not.toContain("GOOGLE_CLIENT_SECRET=");
    const start = readFileSync(path.join(repoRoot, "scripts/cloud-agent-start.sh"), "utf8");
    expect(start).toContain("ensure-local-dev-vars.ts");
    expect(start).toContain("db:migrate:local");
    expect(start).not.toMatch(/BETTER_AUTH_SECRET=[0-9a-fA-F]{16,}/);
  });
});
