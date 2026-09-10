import { describe, expect, it } from "vitest";
import {
  attachmentMatchesSession,
  offerMatchesSession,
  recognizeJpegForForm,
} from "./photo-recognize-offer.ts";

const session = { sessionId: "session-a", kind: "log" as const, recordId: null };
const jpegA = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
const jpegB = new Blob([new Uint8Array([2])], { type: "image/jpeg" });

describe("offerMatchesSession", () => {
  it("同じセッションと kind だけ真", () => {
    expect(
      offerMatchesSession(
        { jpeg: jpegA, kind: "log", sessionId: "session-a", generation: 1 },
        session,
      ),
    ).toBe(true);
    expect(
      offerMatchesSession(
        { jpeg: jpegA, kind: "log", sessionId: "session-b", generation: 1 },
        session,
      ),
    ).toBe(false);
    expect(
      offerMatchesSession(
        { jpeg: jpegA, kind: "note", sessionId: "session-a", generation: 1 },
        session,
      ),
    ).toBe(false);
    expect(
      offerMatchesSession({ jpeg: jpegA, kind: "log", sessionId: "", generation: 1 }, session),
    ).toBe(false);
    expect(offerMatchesSession(null, session)).toBe(false);
  });
});

describe("recognizeJpegForForm", () => {
  it("一致する attachment を pending より優先する", () => {
    const offer = { jpeg: jpegB, kind: "log" as const, sessionId: "session-a", generation: 2 };
    expect(
      recognizeJpegForForm({ recognizeJpeg: jpegA, sessionId: "session-a" }, offer, session),
    ).toBe(jpegA);
  });

  it("別セッションの attachment と pending は使わない", () => {
    expect(
      recognizeJpegForForm(
        { recognizeJpeg: jpegA, sessionId: "old" },
        { jpeg: jpegB, kind: "log", sessionId: "old", generation: 1 },
        session,
      ),
    ).toBeNull();
  });

  it("sessionId の無い attachment は使わない", () => {
    expect(recognizeJpegForForm({ recognizeJpeg: jpegA }, null, session)).toBeNull();
  });

  it("一致する pending だけ返す", () => {
    expect(
      recognizeJpegForForm(
        undefined,
        { jpeg: jpegB, kind: "log", sessionId: "session-a", generation: 1 },
        session,
      ),
    ).toBe(jpegB);
  });
});

describe("attachmentMatchesSession", () => {
  it("sessionId が無い、または不一致なら偽", () => {
    expect(attachmentMatchesSession({ sessionId: "session-a" }, session)).toBe(true);
    expect(attachmentMatchesSession({ sessionId: "other" }, session)).toBe(false);
    expect(attachmentMatchesSession({}, session)).toBe(false);
    expect(attachmentMatchesSession(null, session)).toBe(false);
  });
});
