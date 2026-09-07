import "@/shared/zod-config.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installTheme } from "@/client/lib/theme.ts";
import { App } from "./App";
import "./styles.css";

// 設定「外観」を最初の描画より前に <html data-theme> へ反映する（06-settings S10）
installTheme();

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root が見つかりません");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
