export function formatRelativeShareTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const diffMs = now.getTime() - at.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "たった今";
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "たった今";
  }
  if (minutes < 60) {
    return `${minutes}分前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}時間前`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}日前`;
  }
  return `${at.getFullYear()}/${String(at.getMonth() + 1).padStart(2, "0")}/${String(at.getDate()).padStart(2, "0")}`;
}
