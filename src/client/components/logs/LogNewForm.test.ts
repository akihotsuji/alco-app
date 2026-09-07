import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "LogNewForm.tsx"), "utf8");
const edit = readFileSync(join(here, "LogEditForm.tsx"), "utf8");

describe("LogNewForm 写真からの種類・量の先埋め", () => {
  it("新規だけ推測し、触った欄は上書きしない。編集は変えない", () => {
    expect(source).toContain("startDrinkRecognition");
    expect(source).toContain("applyRecognizeToLogForm");
    expect(source).toContain("DRINK_RECOGNIZE_BANNER");
    expect(source).toContain("touchedRef.current.drinkType = true");
    expect(source).toContain("touchedRef.current.volumeMl = true");
    expect(edit).not.toContain("startDrinkRecognition");
  });
});
