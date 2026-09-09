import { describe, expect, it } from "vitest";
import { PROD_CANONICAL_ORIGIN } from "@/shared/prod-canonical.ts";
import { handleFetch } from "./index.ts";

const unusedCtx = {} as ExecutionContext;

function envWith(values: object): Env {
  return values as unknown as Env;
}

describe("handleFetch", () => {
  it("本番の workers.dev と www を 308 する", async () => {
    const env = envWith({ CANONICAL_ORIGIN: PROD_CANONICAL_ORIGIN });
    const fromWorkers = await handleFetch(
      new Request("https://alco-app-prod.example.workers.dev/login?n=1"),
      env,
      unusedCtx,
    );
    expect(fromWorkers.status).toBe(308);
    expect(fromWorkers.headers.get("location")).toBe(`${PROD_CANONICAL_ORIGIN}/login?n=1`);

    const fromWww = await handleFetch(
      new Request("https://www.sake-shiori.com/api/health"),
      env,
      unusedCtx,
    );
    expect(fromWww.status).toBe(308);
    expect(fromWww.headers.get("location")).toBe(`${PROD_CANONICAL_ORIGIN}/api/health`);
  });

  it("dev では workers.dev 相当でもリダイレクトしない", async () => {
    const response = await handleFetch(
      new Request("https://alco-app-dev.example.workers.dev/api/health"),
      envWith({}),
      unusedCtx,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("apex の API はそのまま処理する", async () => {
    const response = await handleFetch(
      new Request(`${PROD_CANONICAL_ORIGIN}/api/health`),
      envWith({ CANONICAL_ORIGIN: PROD_CANONICAL_ORIGIN }),
      unusedCtx,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("本番で worker-first の SPA は ASSETS に渡す", async () => {
    const response = await handleFetch(
      new Request(`${PROD_CANONICAL_ORIGIN}/login`),
      envWith({
        CANONICAL_ORIGIN: PROD_CANONICAL_ORIGIN,
        ASSETS: {
          fetch: async () => new Response("<html>login</html>", { status: 200 }),
        },
      }),
      unusedCtx,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>login</html>");
  });
});
