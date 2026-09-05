import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "./api.ts";
import {
  createQueryClient,
  QUERY_RETRY_COUNT,
  QUERY_STALE_TIME_MS,
  shouldRetryQuery,
} from "./query-client.ts";

function unauthorized() {
  return new ApiRequestError(401, "unauthorized");
}

describe("shouldRetryQuery", () => {
  it("4xx は再試行しない", () => {
    expect(shouldRetryQuery(0, new ApiRequestError(404, "not_found"))).toBe(false);
    expect(shouldRetryQuery(0, unauthorized())).toBe(false);
  });

  it("5xx とネットワーク断は上限回数まで再試行する", () => {
    expect(shouldRetryQuery(0, new ApiRequestError(500, "internal_error"))).toBe(true);
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryQuery(QUERY_RETRY_COUNT, new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("staleTime と retry の既定を持つ", () => {
    const queryClient = createQueryClient({ onUnauthorized: () => {} });
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("query の 401 で onUnauthorized を 1 回呼び、再試行しない", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });
    const queryFn = vi.fn(async () => {
      throw unauthorized();
    });

    await expect(
      queryClient.fetchQuery({ queryKey: ["me"], queryFn, retryDelay: 0 }),
    ).rejects.toBeInstanceOf(ApiRequestError);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("mutation の 401 でも onUnauthorized を呼ぶ", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });
    const observer = new MutationObserver(queryClient, {
      mutationFn: async () => {
        throw unauthorized();
      },
    });

    await expect(observer.mutate()).rejects.toBeInstanceOf(ApiRequestError);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("401 以外のエラーでは onUnauthorized を呼ばない", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });

    await expect(
      queryClient.fetchQuery({
        queryKey: ["missing"],
        queryFn: async () => {
          throw new ApiRequestError(404, "not_found");
        },
        retryDelay: 0,
      }),
    ).rejects.toBeInstanceOf(ApiRequestError);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("5xx は 1 回だけ再試行する", async () => {
    const queryClient = createQueryClient({ onUnauthorized: () => {} });
    const queryFn = vi.fn(async () => {
      throw new ApiRequestError(500, "internal_error");
    });

    await expect(
      queryClient.fetchQuery({ queryKey: ["flaky"], queryFn, retryDelay: 0 }),
    ).rejects.toBeInstanceOf(ApiRequestError);

    expect(queryFn).toHaveBeenCalledTimes(1 + QUERY_RETRY_COUNT);
  });

  it("clear() でキャッシュが空になる（ログアウト時）", async () => {
    const queryClient = createQueryClient({ onUnauthorized: () => {} });
    await queryClient.fetchQuery({ queryKey: ["me"], queryFn: async () => ({ id: "u1" }) });
    expect(queryClient.getQueryData(["me"])).toEqual({ id: "u1" });

    queryClient.clear();

    expect(queryClient.getQueryData(["me"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
