import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "use-bottle-batch.ts"), "utf8");

describe("useBottleBatch 連続撮影 / 複数選択（04-cellar G8）", () => {
  it("撮影は burst で次枠を予約し、ライブラリは multiple で順に積む", () => {
    expect(source).toContain('pickImages("library", { multiple: true })');
    expect(source).toContain("takeFilesForBatch(files, remaining)");
    expect(source).toContain("processCellarFile(file)");
    expect(source).toContain("ingestCollected(processed, bindKey(crypto.randomUUID()))");
    expect(source).toContain("canReserveBatchRow(reservedRef.current)");
    expect(source).toContain("nextCollect: reserveCollect");
    expect(source).toContain("burst: {");
  });

  it("表面 JPEG の初回だけ自動読み取りし、裏面追加では走らない", () => {
    expect(source).toContain("runRowRecognition(row.key, jpeg, null, false)");
    expect(source).not.toContain("runRowRecognition(row.key, jpeg, back, false)");
    expect(source).toContain("row.backPhoto?.recognizeJpeg ?? null, true");
  });
});
