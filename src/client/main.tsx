import "@/shared/zod-config.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installAssetRecovery } from "@/client/lib/asset-recovery.ts";
import { installKeyboardInset } from "@/client/lib/keyboard-inset.ts";
import { installServiceWorker } from "@/client/lib/register-sw.ts";
import { installTheme } from "@/client/lib/theme.ts";
import { App } from "./App";
import { AppErrorBoundary } from "./components/feedback/AppErrorBoundary.tsx";
import "./styles.css";

// 設定「外観」を最初の描画より前に <html data-theme> へ反映する（06-settings S10）
installTheme();
installAssetRecovery();
installServiceWorker();
window.__alcoMarkBootReady?.();

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root が見つかりません");
}

installKeyboardInset();

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
