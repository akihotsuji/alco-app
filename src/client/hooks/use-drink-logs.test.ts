import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "use-drink-logs.ts"),
  "utf8",
);

describe("useCreateDrinkLog", () => {
  it("保存後は記録一覧とサマリーの両方を無効化する", () => {
    const create = source.slice(
      source.indexOf("export function useCreateDrinkLog"),
      source.indexOf("export function useDeleteDrinkLog"),
    );
    expect(create).toContain("queryKeys.drinkLogs");
    expect(create).toContain("queryKeys.drinkLogSummaries");
  });
});
