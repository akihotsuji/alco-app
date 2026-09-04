import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Vite / Vitest で共有する `@/` → `src/` */
export const srcAlias = {
  "@": path.join(rootDir, "src"),
};
