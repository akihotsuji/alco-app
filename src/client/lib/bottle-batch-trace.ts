export type BatchTraceEvent = {
  ingestId: string;
  rowKey?: string;
  stage: "pick" | "accept" | "convert" | "upload" | "recognize" | "save" | "discard";
  outcome: "ok" | "error" | "skip";
  code?: string;
  httpStatus?: number;
  elapsedMs?: number;
  bytes?: number;
  width?: number;
  height?: number;
  mime?: string;
  picked?: number;
  accepted?: number;
  overflow?: number;
};

/** 画像本体・Base64・認証・位置・ファイル名・AI 生レスポンスは載せない */
export function batchTracePayload(event: BatchTraceEvent): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ingestId: event.ingestId,
    stage: event.stage,
    outcome: event.outcome,
  };
  if (event.rowKey) {
    payload.rowKey = event.rowKey;
  }
  if (event.code) {
    payload.code = event.code;
  }
  if (event.httpStatus !== undefined) {
    payload.httpStatus = event.httpStatus;
  }
  if (event.elapsedMs !== undefined) {
    payload.elapsedMs = event.elapsedMs;
  }
  if (event.bytes !== undefined) {
    payload.bytes = event.bytes;
  }
  if (event.width !== undefined) {
    payload.width = event.width;
  }
  if (event.height !== undefined) {
    payload.height = event.height;
  }
  if (event.mime) {
    payload.mime = event.mime;
  }
  if (event.picked !== undefined) {
    payload.picked = event.picked;
  }
  if (event.accepted !== undefined) {
    payload.accepted = event.accepted;
  }
  if (event.overflow !== undefined) {
    payload.overflow = event.overflow;
  }
  return payload;
}

export function traceBatchEvent(event: BatchTraceEvent): void {
  console.info("[bottle-batch]", batchTracePayload(event));
}

export function blobTraceFields(blob: Blob): Pick<BatchTraceEvent, "bytes" | "mime"> {
  return {
    bytes: blob.size,
    mime: blob.type || "unknown",
  };
}
