import { describe, expect, expectTypeOf, it } from "vitest";
import { ApiRequestError, createRpcClient } from "@/client/lib/api.ts";
import { createQueryClient } from "@/client/lib/query-client.ts";
import { cookieHeaderFrom, createTestApp, signUp } from "@/server/test-helpers.ts";
import { type Me, meQueryKey, meQueryOptions } from "./use-me.ts";

describe("meQueryOptions", () => {
  it('queryKey は ["me"]', () => {
    expect(meQueryOptions().queryKey).toEqual(["me"]);
    expect(meQueryKey).toEqual(["me"]);
  });

  it("ログイン中は { id, email, name } を返す", async () => {
    const { app } = await createTestApp();
    const signUpRes = await signUp(app, {
      name: "花子",
      email: "hanako@example.com",
      password: "password-hanako",
    });
    const cookie = cookieHeaderFrom(signUpRes);
    const client = createRpcClient(async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Cookie", cookie);
      return app.request(input, { ...init, headers });
    });
    const queryClient = createQueryClient({ onUnauthorized: () => {} });

    const me = await queryClient.fetchQuery(meQueryOptions(client));

    expectTypeOf(me).toEqualTypeOf<Me>();
    expectTypeOf<Me>().toEqualTypeOf<{ id: string; email: string; name: string }>();
    expect(me).toEqual({ id: expect.any(String), email: "hanako@example.com", name: "花子" });
    expect(queryClient.getQueryData(meQueryKey)).toEqual(me);
  });

  it("未ログインは 401 で onUnauthorized が呼ばれる", async () => {
    const { app } = await createTestApp();
    const client = createRpcClient(async (input, init) => app.request(input, init));
    let unauthorizedCalls = 0;
    const queryClient = createQueryClient({
      onUnauthorized: () => {
        unauthorizedCalls += 1;
      },
    });

    await expect(
      queryClient.fetchQuery({ ...meQueryOptions(client), retryDelay: 0 }),
    ).rejects.toBeInstanceOf(ApiRequestError);

    expect(unauthorizedCalls).toBe(1);
  });
});
