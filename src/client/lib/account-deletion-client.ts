import { ACCOUNT_DELETION_CHANNEL, ACCOUNT_DELETION_PENDING_USER_KEY } from "@/shared/account-deletion.ts";
import { GUIDE_PREF_KEY, PHOTO_CUTOUT_DIAG_KEY } from "@/shared/constants.ts";

const OPENED_FOLLOWUP_PREFIX = "opened.followup.";
const CELLAR_SHELF_EVENT_KEY = "cellar.shelfEvent";

function removeMatchingKeys(storage: Storage, shouldRemove: (key: string) => boolean) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && shouldRemove(key)) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    storage.removeItem(key);
  }
}

/** アカウントに紐づく下書き・ガイド進捗・切り抜き診断だけ捨てる。テーマ等は残す。 */
export function discardAccountScopedClientData(): void {
  try {
    localStorage.removeItem(GUIDE_PREF_KEY);
  } catch {
    // プライベートモード等
  }
  try {
    sessionStorage.removeItem(PHOTO_CUTOUT_DIAG_KEY);
    sessionStorage.removeItem(CELLAR_SHELF_EVENT_KEY);
    sessionStorage.removeItem(ACCOUNT_DELETION_PENDING_USER_KEY);
    removeMatchingKeys(sessionStorage, (key) => key.startsWith(OPENED_FOLLOWUP_PREFIX));
  } catch {
    // プライベートモード等
  }
}

export function notifyAccountDeletionAccepted(): void {
  try {
    const channel = new BroadcastChannel(ACCOUNT_DELETION_CHANNEL);
    channel.postMessage({ type: "accepted" });
    channel.close();
  } catch {
    // BroadcastChannel 非対応でも当該タブの後処理は続ける
  }
}

export function subscribeAccountDeletionAccepted(onAccepted: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  const channel = new BroadcastChannel(ACCOUNT_DELETION_CHANNEL);
  const onMessage = (event: MessageEvent) => {
    if (event.data && typeof event.data === "object" && event.data.type === "accepted") {
      onAccepted();
    }
  };
  channel.addEventListener("message", onMessage);
  return () => {
    channel.removeEventListener("message", onMessage);
    channel.close();
  };
}
