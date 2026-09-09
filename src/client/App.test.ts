import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "App.tsx"), "utf8");
const lazyPages = readFileSync(join(here, "pages/lazy-pages.tsx"), "utf8");
const main = readFileSync(join(here, "main.tsx"), "utf8");
const html = readFileSync(join(here, "../../index.html"), "utf8");
const boot = readFileSync(join(here, "boot-prefetch.ts"), "utf8");

describe("ルート分割", () => {
  it("App は画面を静的 import せず lazy-pages 経由にする", () => {
    expect(app).toContain('from "./pages/lazy-pages.tsx"');
    expect(app).not.toContain('from "./pages/HomePage.tsx"');
    expect(app).not.toContain('from "./pages/cellar/CellarPages.tsx"');
    expect(app).not.toContain('from "./pages/notes/NotePages.tsx"');
    expect(app).not.toContain('from "./pages/summary/SummaryPages.tsx"');
    expect(app).not.toContain("PhotoEditProvider");
    expect(app).not.toContain("AppShell");
    expect(lazyPages).toContain('import("@/client/layout/AuthenticatedLayout.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/AgePage.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/HomePage.tsx")');
    expect(app).toContain("RequireAgeVerified");
    expect(app).toContain('path="/age"');
    expect(lazyPages).toContain('import("@/client/pages/cellar/CellarPages.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/notes/NotePages.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/summary/SummaryPages.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/logs/LogFormPage.tsx")');
    expect(main).not.toContain("prefetchInitialRoute()");
    expect(html).toContain("/src/client/boot-prefetch.ts");
    expect(boot).toContain("prefetchInitialRoute()");
    expect(boot).not.toMatch(/^import /m);
  });

  it("ゲスト画面の初期 JS から ToastProvider を外す", () => {
    const guestOnly = readFileSync(join(here, "auth/GuestOnly.tsx"), "utf8");
    expect(guestOnly).not.toContain("ToastProvider");
    expect(app).not.toContain("ToastProvider");
  });
});
