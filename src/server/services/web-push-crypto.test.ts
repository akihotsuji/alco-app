import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "@/shared/base64url.ts";
import {
  createVapidJwt,
  encryptPushPayload,
  generateLocalEcdhKeys,
  importLocalEcdhKeys,
  importVapidSigningKey,
  vapidAuthorization,
} from "./web-push-crypto.ts";

/** RFC 8291 5 章 / 付録 A の例（公開された試験値。実環境の鍵ではない） */
const RFC8291 = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

function bytes(value: string): Uint8Array<ArrayBuffer> {
  const decoded = decodeBase64Url(value);
  if (!decoded) {
    throw new Error("bad base64url in test");
  }
  return decoded;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new Uint8Array(data)));
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string | Uint8Array, len: number) {
  const infoBytes = typeof info === "string" ? new TextEncoder().encode(info) : info;
  const prk = await hmac(salt, ikm);
  const joined = new Uint8Array(infoBytes.length + 1);
  joined.set(infoBytes);
  joined[infoBytes.length] = 1;
  return (await hmac(prk, joined)).slice(0, len);
}

/** 受信側（ブラウザ）と同じ手順で復号する。送信側の実装とは独立に書く */
async function decryptAsUserAgent(input: {
  body: Uint8Array;
  uaKeys: CryptoKeyPair;
  uaPublic: Uint8Array;
  authSecret: Uint8Array;
}): Promise<{ plaintext: string; recordSize: number; keyIdLength: number }> {
  const salt = input.body.slice(0, 16);
  const recordSize = new DataView(input.body.buffer, input.body.byteOffset).getUint32(16, false);
  const keyIdLength = input.body[20] ?? 0;
  const asPublic = input.body.slice(21, 21 + keyIdLength);
  const ciphertext = input.body.slice(21 + keyIdLength);
  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, input.uaKeys.privateKey, 256),
  );
  const info = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\u0000"),
    ...input.uaPublic,
    ...asPublic,
  ]);
  const ikm = await hkdf(input.authSecret, ecdh, info, 32);
  const cek = await hkdf(salt, ikm, "Content-Encoding: aes128gcm\u0000", 16);
  const nonce = await hkdf(salt, ikm, "Content-Encoding: nonce\u0000", 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext),
  );
  expect(padded.at(-1)).toBe(2);
  return {
    plaintext: new TextDecoder().decode(padded.slice(0, -1)),
    recordSize,
    keyIdLength,
  };
}

describe("aes128gcm（RFC 8291）", () => {
  it("RFC 8291 付録 A の試験値と同じ本文になる", async () => {
    const localKeys = await importLocalEcdhKeys(bytes(RFC8291.asPrivate), bytes(RFC8291.asPublic));
    const body = await encryptPushPayload({
      plaintext: new TextEncoder().encode(RFC8291.plaintext),
      uaPublic: bytes(RFC8291.uaPublic),
      authSecret: bytes(RFC8291.authSecret),
      salt: bytes(RFC8291.salt),
      localKeys,
    });
    expect(encodeBase64Url(body)).toBe(RFC8291.body);
  });

  it("使い捨て鍵と乱数ソルトで暗号化し、受信側の手順で復号できる", async () => {
    const uaKeys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", uaKeys.publicKey));
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const payload = JSON.stringify({ v: 1, type: "reaction", unread: 2 });
    const first = await encryptPushPayload({
      plaintext: new TextEncoder().encode(payload),
      uaPublic,
      authSecret,
    });
    const second = await encryptPushPayload({
      plaintext: new TextEncoder().encode(payload),
      uaPublic,
      authSecret,
    });
    expect(encodeBase64Url(first)).not.toBe(encodeBase64Url(second));
    const decrypted = await decryptAsUserAgent({ body: first, uaKeys, uaPublic, authSecret });
    expect(decrypted).toEqual({ plaintext: payload, recordSize: 4096, keyIdLength: 65 });
  });

  it("鍵が不正・本文がレコードに収まらないときは例外", async () => {
    const local = await generateLocalEcdhKeys();
    await expect(
      encryptPushPayload({
        plaintext: new Uint8Array(1),
        uaPublic: new Uint8Array(65),
        authSecret: new Uint8Array(16),
        localKeys: local,
      }),
    ).rejects.toThrow();
    await expect(
      encryptPushPayload({
        plaintext: new Uint8Array(4096),
        uaPublic: local.publicRaw,
        authSecret: new Uint8Array(16),
      }),
    ).rejects.toThrow("too large");
  });
});

describe("VAPID（RFC 8292）", () => {
  async function vapidPair() {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    return {
      verifyKey: pair.publicKey,
      keys: { publicKey: encodeBase64Url(publicRaw), privateKey: jwk.d ?? "" },
    };
  }

  it("ES256 の JWT を作り、公開鍵で検証でき、aud / exp / sub を持つ", async () => {
    const { verifyKey, keys } = await vapidPair();
    const signingKey = await importVapidSigningKey(keys);
    const jwt = await createVapidJwt({
      signingKey,
      audience: "https://fcm.googleapis.com",
      subject: "https://sake-shiori.com",
      expiresAtSec: 1_900_000_000,
    });
    const [header = "", claims = "", signature = ""] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(bytes(header)))).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    expect(JSON.parse(new TextDecoder().decode(bytes(claims)))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_900_000_000,
      sub: "https://sake-shiori.com",
    });
    expect(bytes(signature).length).toBe(64);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      bytes(signature),
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(ok).toBe(true);
    expect(vapidAuthorization(jwt, keys.publicKey)).toBe(`vapid t=${jwt}, k=${keys.publicKey}`);
  });

  it("形式の違う鍵は取り込まない", async () => {
    const { keys } = await vapidPair();
    await expect(importVapidSigningKey({ ...keys, privateKey: "short" })).rejects.toThrow();
    await expect(importVapidSigningKey({ ...keys, publicKey: "@@" })).rejects.toThrow();
  });
});
