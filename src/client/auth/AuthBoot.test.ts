import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOOT_COPY } from "@/client/lib/boot.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("AuthBoot", () => {
  it("起動文言と再試行を持つ", () => {
    const source = readFileSync(join(here, "AuthBoot.tsx"), "utf8");
    expect(source).toContain("BOOT_COPY.loading");
    expect(source).toContain("BOOT_COPY.slow");
    expect(source).toContain("BOOT_COPY.failed");
    expect(source).toContain("BOOT_COPY.retry");
    expect(BOOT_COPY.loading).toBe("読み込み中");
    expect(BOOT_COPY.slow).toBe("読み込みに時間がかかっています");
  });

  it("RequireAuth は通信失敗で login に即飛ばない", () => {
    const requireAuth = readFileSync(join(here, "RequireAuth.tsx"), "utf8");
    const guestOnly = readFileSync(join(here, "GuestOnly.tsx"), "utf8");
    expect(requireAuth).toContain("boot.variant");
    expect(requireAuth).toContain('boot.kind === "guest"');
    expect(guestOnly).toContain("boot.variant");
    expect(guestOnly).toContain("resolveGuestOnlyContent");
  });
});
