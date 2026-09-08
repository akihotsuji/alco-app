import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "App.tsx"), "utf8");
const lazyPages = readFileSync(join(here, "pages/lazy-pages.tsx"), "utf8");
const main = readFileSync(join(here, "main.tsx"), "utf8");

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
    expect(lazyPages).toContain('import("@/client/pages/HomePage.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/cellar/CellarPages.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/notes/NotePages.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/summary/SummaryPages.tsx")');
    expect(lazyPages).toContain('import("@/client/pages/logs/LogFormPage.tsx")');
    expect(main).toContain("prefetchInitialRoute()");
  });
});
