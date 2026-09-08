import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DRINK_TYPES } from "@/shared/constants.ts";
import { SILHOUETTE_PATHS } from "./BottleSilhouette.tsx";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "BottleSilhouette.tsx"),
  "utf8",
);

describe("BottleSilhouette", () => {
  it("12 種それぞれにパスがあり、形が重ならない", () => {
    expect(Object.keys(SILHOUETTE_PATHS)).toEqual([...DRINK_TYPES]);
    const signatures = DRINK_TYPES.map((type) => SILHOUETTE_PATHS[type].join("|"));
    expect(new Set(signatures).size).toBe(DRINK_TYPES.length);
  });

  it("線は currentColor、塗りは持たない", () => {
    expect(source).toContain('stroke="currentColor"');
    expect(source).toContain('fill="none"');
  });
});
