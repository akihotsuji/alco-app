import { describe, expect, it } from "vitest";
import {
  MASCOT_HEAVY_AUTO_RULE,
  parseMascotPreview,
  resolveMascotPresence,
} from "./mascot-presence";

describe("resolveMascotPresence", () => {
  it("プレビュー以外では多量を自動表示しない", () => {
    expect(MASCOT_HEAVY_AUTO_RULE).toBe("undecided");
    expect(resolveMascotPresence({ todayCount: 12 })).toEqual({
      presence: "upright",
      autoHeavy: false,
    });
    expect(resolveMascotPresence({ todayCount: 0 })).toEqual({
      presence: "resting",
      autoHeavy: false,
    });
    expect(resolveMascotPresence({ todayCount: null })).toEqual({
      presence: "resting",
      autoHeavy: false,
    });
  });

  it("?mascotPreview=heavy だけ横倒れを出す", () => {
    expect(parseMascotPreview("heavy")).toBe("heavy");
    expect(parseMascotPreview("1")).toBeNull();
    expect(resolveMascotPresence({ todayCount: 0, preview: "heavy" })).toEqual({
      presence: "heavy",
      autoHeavy: false,
    });
  });
});
