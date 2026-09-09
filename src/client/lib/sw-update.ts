import { SW_UPDATE_EVENT } from "@/client/lib/boot.ts";

export function notifySwUpdateAvailable(target: EventTarget = window): void {
  target.dispatchEvent(new Event(SW_UPDATE_EVENT));
}

/** この文書読み込み開始時点で既に制御されていたら「更新」。初回 claim は再読み込みしない */
export function shouldReloadOnControllerChange(hadControllerAtStart: boolean): boolean {
  return hadControllerAtStart;
}
