import { decodeBase64Url, encodeBase64Url } from "@/shared/base64url.ts";

/**
 * Web Push のメッセージ暗号化（RFC 8291 / RFC 8188 `aes128gcm`）と VAPID（RFC 8292）。
 * Workers の WebCrypto だけで組む（依存を足さない）。鍵・JWT はログに出さない。
 */

const encoder = new TextEncoder();
const P256 = { name: "ECDH", namedCurve: "P-256" } as const;
export const AES128GCM_RECORD_SIZE = 4096;
const TAG_BYTES = 16;
const SALT_BYTES = 16;
const PUBLIC_KEY_BYTES = 65;

export type LocalEcdhKeys = { privateKey: CryptoKey; publicRaw: Uint8Array<ArrayBuffer> };

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, new Uint8Array(data)));
}

/** HKDF-SHA256 の Extract + Expand（出力 32 バイト以下なので T(1) だけ） */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const prk = await hmacSha256(salt, ikm);
  const okm = await hmacSha256(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

function splitPublicKey(publicRaw: Uint8Array): { x: string; y: string } {
  if (publicRaw.length !== PUBLIC_KEY_BYTES || publicRaw[0] !== 0x04) {
    throw new Error("invalid P-256 public key");
  }
  return {
    x: encodeBase64Url(publicRaw.slice(1, 33)),
    y: encodeBase64Url(publicRaw.slice(33, 65)),
  };
}

function privateJwk(privateD: Uint8Array, publicRaw: Uint8Array): JsonWebKey {
  if (privateD.length !== 32) {
    throw new Error("invalid P-256 private key");
  }
  return { kty: "EC", crv: "P-256", d: encodeBase64Url(privateD), ...splitPublicKey(publicRaw) };
}

export async function generateLocalEcdhKeys(): Promise<LocalEcdhKeys> {
  const pair = (await crypto.subtle.generateKey(P256, true, ["deriveBits"])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { privateKey: pair.privateKey, publicRaw };
}

/** テストベクタ用。通常の送信は毎回 `generateLocalEcdhKeys()` の使い捨て鍵を使う */
export async function importLocalEcdhKeys(
  privateD: Uint8Array,
  publicRaw: Uint8Array,
): Promise<LocalEcdhKeys> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk(privateD, publicRaw),
    P256,
    false,
    ["deriveBits"],
  );
  return { privateKey, publicRaw: new Uint8Array(publicRaw) };
}

/**
 * RFC 8291 3.4 / RFC 8188 2。1 レコード、パディングなし。
 * 出力 = salt(16) || rs(4) || idlen(1)=65 || as_public(65) || ciphertext
 */
export async function encryptPushPayload(input: {
  plaintext: Uint8Array;
  uaPublic: Uint8Array;
  authSecret: Uint8Array;
  salt?: Uint8Array;
  localKeys?: LocalEcdhKeys;
  recordSize?: number;
}): Promise<Uint8Array<ArrayBuffer>> {
  const recordSize = input.recordSize ?? AES128GCM_RECORD_SIZE;
  const padded = concat(input.plaintext, new Uint8Array([2]));
  if (padded.length + TAG_BYTES > recordSize) {
    throw new Error("push payload too large");
  }
  splitPublicKey(input.uaPublic);
  const local = input.localKeys ?? (await generateLocalEcdhKeys());
  const salt = input.salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  if (salt.length !== SALT_BYTES) {
    throw new Error("invalid salt");
  }

  const uaKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(input.uaPublic),
    P256,
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256),
  );
  const keyInfo = concat(encoder.encode("WebPush: info\u0000"), input.uaPublic, local.publicRaw);
  const ikm = await hkdf(input.authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\u0000"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\u0000"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, padded),
  );

  const header = new Uint8Array(SALT_BYTES + 4 + 1);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(SALT_BYTES, recordSize, false);
  header[SALT_BYTES + 4] = local.publicRaw.length;
  return concat(header, local.publicRaw, ciphertext);
}

export type VapidKeys = { publicKey: string; privateKey: string };

export async function importVapidSigningKey(keys: VapidKeys): Promise<CryptoKey> {
  const publicRaw = decodeBase64Url(keys.publicKey);
  const privateD = decodeBase64Url(keys.privateKey);
  if (!publicRaw || !privateD) {
    throw new Error("invalid VAPID key");
  }
  return crypto.subtle.importKey(
    "jwk",
    privateJwk(privateD, publicRaw),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** RFC 8292 2。ES256 の署名は WebCrypto の raw（r || s）がそのまま JWS 形式 */
export async function createVapidJwt(input: {
  signingKey: CryptoKey;
  audience: string;
  subject: string;
  expiresAtSec: number;
}): Promise<string> {
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = encodeBase64Url(
    encoder.encode(
      JSON.stringify({ aud: input.audience, exp: input.expiresAtSec, sub: input.subject }),
    ),
  );
  const signingInput = `${header}.${claims}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      input.signingKey,
      encoder.encode(signingInput),
    ),
  );
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

export function vapidAuthorization(jwt: string, publicKey: string): string {
  return `vapid t=${jwt}, k=${publicKey}`;
}
