import { createAuthClient } from "better-auth/react";
import { AUTH_FETCH_TIMEOUT_MS } from "./boot.ts";
import { takeEarlyFetch } from "./early-fetch.ts";
import { createTimedFetch } from "./fetch-timeout.ts";

export const authClient = createAuthClient({
  fetchOptions: {
    customFetchImpl: createTimedFetch({
      fetchImpl: fetch,
      takeEarly: takeEarlyFetch,
      timeoutMs: AUTH_FETCH_TIMEOUT_MS,
    }),
  },
});
