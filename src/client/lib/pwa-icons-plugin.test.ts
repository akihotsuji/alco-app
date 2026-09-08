import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PWA_ICON_FILES } from "@/shared/pwa.ts";
import { generatePwaIcons } from "../../../vite.pwa-icons.ts";

function basename(relativePath: string): string {
  return relativePath.slice(relativePath.lastIndexOf("/") + 1);
}

describe("generatePwaIcons", () => {
  it("192 / 512 / maskable / Apple touch の PNG を書く", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "alco-pwa-icons-"));
    await generatePwaIcons(outDir);
    const names = [
      PWA_ICON_FILES.any192,
      PWA_ICON_FILES.any512,
      PWA_ICON_FILES.maskable512,
      PWA_ICON_FILES.appleTouch,
    ].map(basename);
    for (const name of names) {
      const bytes = await readFile(join(outDir, name));
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.byteLength).toBeGreaterThan(1000);
    }
  });
});
