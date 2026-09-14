import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "use-bottle-batch.ts"), "utf8");

describe("useBottleBatch 連続撮影 / 複数選択（04-cellar G8）", () => {
  it("撮影は burst で次枠を予約し、ライブラリは選択直後に行を足してキューする", () => {
    expect(source).toContain('pickImages("library", { multiple: true })');
    expect(source).toContain("acceptFilesForBatch(files, remaining)");
    expect(source).toContain("newQueuedBatchRow(job.key, job.ingestId)");
    expect(source).toContain("enqueueJobs(jobs)");
    expect(source).toContain("processCellarFile(job.file)");
    expect(source).toContain("pickerLockRef.current");
    expect(source).toContain("canReserveBatchRow(reservedRef.current)");
    expect(source).toContain("nextCollect: reserveCollect");
    expect(source).toContain("burst: {");
    expect(source).not.toContain("takeFilesForBatch(files, remaining)");
    expect(source).not.toContain("ingestCollected(processed, bindKey(crypto.randomUUID()))");
  });

  it("表面 JPEG の初回だけ自動読み取りし、裏面追加では走らない", () => {
    expect(source).toContain("runRowRecognition(row.key, jpeg, null, false)");
    expect(source).not.toContain("runRowRecognition(row.key, jpeg, back, false)");
    expect(source).toContain("row.backPhoto?.recognizeJpeg ?? null, true");
  });

  it("再試行は失敗工程だけ。保存は対象行のみ同じ operationKey", () => {
    expect(source).toContain('current.failure?.stage === "convert"');
    expect(source).toContain("runBatchUploadJob");
    expect(source).toContain("if (!isBatchRowSavable(row))");
    expect(source).toContain("row.saveOperationKey ?? newOperationKey()");
    expect(source).toContain("retryLockRef.current");
    expect(source).toContain("reservedKeysRef.current");
  });
});
