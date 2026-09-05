import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "./api.ts";
import {
  createQueryClient,
  QUERY_RETRY_LIMIT,
  QUERY_STALE_TIME_MS,
  shouldRetryQuery,
} from "./query-client.ts";

describe("shouldRetryQuery", () => {
  it("4xx は再試行しない", () => {
    expect(shouldRetryQuery(0, new ApiClientError(401, "unauthorized"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiClientError(404, "not_found"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiClientError(400, "validation_error"))).toBe(false);
  });

  it("5xx とネットワークエラーは上限まで再試行する", () => {
    expect(shouldRetryQuery(0, new ApiClientError(500, "internal_error"))).toBe(true);
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryQuery(QUERY_RETRY_LIMIT, new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("staleTime と retry の既定値を持つ", () => {
    const queryClient = createQueryClient();
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("query が 401 になると onUnauthorized を呼び、再試行しない", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });
    const queryFn = vi.fn(async () => {
      throw new ApiClientError(401, "unauthorized");
    });

    await expect(queryClient.fetchQuery({ queryKey: ["me"], queryFn })).rejects.toBeInstanceOf(
      ApiClientError,
    );
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith(queryClient);
  });

  it("mutation が 401 になっても onUnauthorized を呼ぶ", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: async () => {
        throw new ApiClientError(401, "unauthorized");
      },
    });

    await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(ApiClientError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("401 以外のエラーでは onUnauthorized を呼ばない", async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });

    await expect(
      queryClient.fetchQuery({
        queryKey: ["me"],
        queryFn: async () => {
          throw new ApiClientError(404, "not_found");
        },
      }),
    ).rejects.toBeInstanceOf(ApiClientError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("clear でキャッシュが空になる", async () => {
    const queryClient = createQueryClient();
    await queryClient.fetchQuery({ queryKey: ["me"], queryFn: async () => ({ id: "u1" }) });
    expect(queryClient.getQueryData(["me"])).toEqual({ id: "u1" });

    queryClient.clear();
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
