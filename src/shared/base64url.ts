/** RFC 4648 §5 の base64url（パディングなし）。Web Push の鍵・JWT・ペイロードで使う。 */

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** 不正な文字・長さのときは null。標準 base64 の `+` `/` `=` は受けない。 */
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL_PATTERN.test(value) || value.length % 4 === 1) {
    return null;
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  let binary: string;
  try {
    binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  } catch {
    return null;
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
