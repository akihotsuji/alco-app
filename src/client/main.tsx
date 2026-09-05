import "@/shared/zod-config.ts";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { redirectToLogin } from "./lib/auth-redirect.ts";
import { createQueryClient } from "./lib/query-client.ts";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root が見つかりません");
}

const queryClient = createQueryClient({ onUnauthorized: redirectToLogin });

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
