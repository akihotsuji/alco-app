import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { expireSession } from "@/client/auth/session-expiry.ts";
import { createQueryClient } from "./query-client.ts";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() =>
    createQueryClient({
      onUnauthorized: () => {
        void expireSession();
      },
    }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
