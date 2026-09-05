import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { endSession } from "@/client/auth/end-session.ts";
import { createQueryClient } from "./query-client.ts";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() =>
    createQueryClient({
      onUnauthorized: () => {
        void endSession();
      },
    }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
