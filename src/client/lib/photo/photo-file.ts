/** アップロード / 再デコード用のファイル名。サーバーは magic bytes を見る */
export function photoFileName(type: string): string {
  if (type === "image/webp") {
    return "photo.webp";
  }
  if (type === "image/png") {
    return "photo.png";
  }
  return "photo.jpg";
}

/** セラー切り抜きのプレビュー判定。WebP または iOS フォールバックの PNG */
export function isCutoutBlobType(type: string): boolean {
  return type === "image/webp" || type === "image/png";
}
