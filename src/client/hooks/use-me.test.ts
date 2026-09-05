import { describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "@/client/lib/api.ts";
import { createQueryClient } from "@/client/lib/query-client.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { cookieHeaderFrom, createTestApp, signUp } from "@/server/test-helpers.ts";
import { meQueryOptions } from "./use-me.ts";

async function createSignedInClient() {
  const { app } = await createTestApp();
  const signUpRes = await signUp(app, {
    name: "ユーザーA",
    email: "a@example.com",
    password: "password1",
  });
  expect(signUpRes.status).toBe(200);
  const cookie = cookieHeaderFrom(signUpRes);

  // ブラウザなら Cookie は自動で付く。Node ではテストがサインアップ時の Cookie を付ける
  const client = createApiClient({
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Cookie", cookie);
      return app.request(input, { ...init, headers });
    },
  });
  return { app, client };
}

describe("meQueryOptions", () => {
  it('queryKey は ["me"]', () => {
    expect(meQueryOptions().queryKey).toEqual(["me"]);
    expect(meQueryOptions().queryKey).toEqual(queryKeys.me);
  });

  it("ログイン済みなら自分の { id, email, name } を返す", async () => {
    const { client } = await createSignedInClient();
    const queryClient = createQueryClient();

    const me = await queryClient.fetchQuery(meQueryOptions(client));
    expect(me).toEqual({ id: expect.any(String), email: "a@example.com", name: "ユーザーA" });
    expect(queryClient.getQueryData(queryKeys.me)).toEqual(me);
  });

  it("未ログインなら 401 で onUnauthorized が呼ばれる", async () => {
    const { app } = await createTestApp();
    const client = createApiClient({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init),
    });
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });

    const error = await queryClient.fetchQuery(meQueryOptions(client)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
  });
});
