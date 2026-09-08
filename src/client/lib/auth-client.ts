import { createAuthClient } from "better-auth/react";
import { takeEarlyFetch } from "./early-fetch.ts";

export const authClient = createAuthClient({
  fetchOptions: {
    customFetchImpl: (input, init) => {
      const early = takeEarlyFetch(input, init);
      if (early) {
        return early;
      }
      return fetch(input, init);
    },
  },
});
