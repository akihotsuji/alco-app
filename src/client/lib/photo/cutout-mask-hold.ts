import { PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";
import {
  type CommittedCutoutMask,
  type CutoutMaskIdentity,
  copyMaskBytes,
  cutoutMaskIdentityEquals,
} from "./cutout-mask-buffer.ts";

export type PhotoSourceOrigin = "original" | "processed";

export type CutoutMaskHold = {
  formSessionId: string;
  origin: PhotoSourceOrigin;
  identity: CutoutMaskIdentity;
  sourceAlpha: Uint8Array;
  baseMask: Uint8Array;
  committed: CommittedCutoutMask;
};

const holds = new Map<string, CutoutMaskHold>();

function holdKey(formSessionId: string, identity: CutoutMaskIdentity): string {
  return `${formSessionId}:${identity.sourceId}:${identity.segmentationKey}`;
}

export function putCutoutMaskHold(hold: CutoutMaskHold): void {
  const key = holdKey(hold.formSessionId, hold.identity);
  holds.delete(key);
  holds.set(key, {
    formSessionId: hold.formSessionId,
    origin: hold.origin,
    identity: { ...hold.identity },
    sourceAlpha: copyMaskBytes(hold.sourceAlpha),
    baseMask: copyMaskBytes(hold.baseMask),
    committed: {
      ...hold.committed,
      data: copyMaskBytes(hold.committed.data),
    },
  });
  while (holds.size > PHOTO_CUTOUT_MASK_EDIT.holdLimit) {
    const oldest = holds.keys().next();
    if (oldest.done) {
      break;
    }
    holds.delete(oldest.value);
  }
}

export function getCutoutMaskHold(
  formSessionId: string,
  identity: CutoutMaskIdentity,
): CutoutMaskHold | null {
  const hold = holds.get(holdKey(formSessionId, identity));
  if (!hold || !cutoutMaskIdentityEquals(hold.identity, identity)) {
    return null;
  }
  return {
    formSessionId: hold.formSessionId,
    origin: hold.origin,
    identity: { ...hold.identity },
    sourceAlpha: copyMaskBytes(hold.sourceAlpha),
    baseMask: copyMaskBytes(hold.baseMask),
    committed: {
      ...hold.committed,
      data: copyMaskBytes(hold.committed.data),
    },
  };
}

export function clearCutoutMaskHoldsForSession(formSessionId: string): void {
  for (const [key, hold] of holds) {
    if (hold.formSessionId === formSessionId) {
      holds.delete(key);
    }
  }
}

export function clearAllCutoutMaskHolds(): void {
  holds.clear();
}

export function cutoutMaskHoldCount(): number {
  return holds.size;
}
