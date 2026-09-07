import "@/shared/zod-config.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installKeyboardInset } from "@/client/lib/keyboard-inset.ts";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root が見つかりません");
}

installKeyboardInset();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
