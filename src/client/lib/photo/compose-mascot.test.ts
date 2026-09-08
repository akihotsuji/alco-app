import { describe, expect, it } from "vitest";
import { PHOTO_MASCOT_POSES } from "@/shared/constants.ts";
import { pickMascotPose } from "./compose-mascot.ts";

describe("pickMascotPose", () => {
  it("4 ポーズのいずれかを返す", () => {
    expect(PHOTO_MASCOT_POSES).toContain(pickMascotPose(() => 0));
    expect(pickMascotPose(() => 0)).toBe("default");
    expect(pickMascotPose(() => 0.99)).toBe("cheer");
  });
});
