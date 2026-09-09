let registered = false;

/** SW 更新など React 外から、未保存の離脱保護があるかを見る */
export function setLeaveGuardRegistered(value: boolean): void {
  registered = value;
}

export function isLeaveGuardRegistered(): boolean {
  return registered;
}
