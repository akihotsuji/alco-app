export type PhotoEditContextKind = "log" | "cellar" | "note";

/** フォーム 1 回分。破棄・保存・レコード切替で新しくする */
export type PhotoFormSession = {
  sessionId: string;
  kind: PhotoEditContextKind;
  recordId: string | null;
};

/** Provider が保持する認識用 JPEG。セッション不一致なら適用しない */
export type PhotoRecognizeOffer = {
  jpeg: Blob;
  kind: PhotoEditContextKind;
  sessionId: string;
  generation: number;
};

export function newPhotoFormSession(
  kind: PhotoEditContextKind,
  recordId: string | null = null,
): PhotoFormSession {
  return { sessionId: crypto.randomUUID(), kind, recordId };
}

export function offerMatchesSession(
  offer: PhotoRecognizeOffer | null | undefined,
  session: PhotoFormSession,
): offer is PhotoRecognizeOffer {
  return (
    offer !== null &&
    offer !== undefined &&
    offer.sessionId.length > 0 &&
    offer.sessionId === session.sessionId &&
    offer.kind === session.kind
  );
}

export function attachmentMatchesSession(
  attachment: { sessionId?: string } | null | undefined,
  session: PhotoFormSession,
): boolean {
  if (!attachment) {
    return false;
  }
  if (!attachment.sessionId) {
    return false;
  }
  return attachment.sessionId === session.sessionId;
}

/** このフォームが適用してよい認識用 JPEG。別セッションの pending / attachment は無視する */
export function recognizeJpegForForm(
  attachment: { recognizeJpeg?: Blob; sessionId?: string } | null | undefined,
  offer: PhotoRecognizeOffer | null | undefined,
  session: PhotoFormSession,
): Blob | null {
  if (attachmentMatchesSession(attachment, session) && attachment?.recognizeJpeg) {
    return attachment.recognizeJpeg;
  }
  if (offerMatchesSession(offer, session)) {
    return offer.jpeg;
  }
  return null;
}
