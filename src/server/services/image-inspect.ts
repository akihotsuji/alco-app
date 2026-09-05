import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_LONG_EDGE,
  type PhotoContentType,
  type PhotoKind,
} from "@/shared/constants.ts";

export type InspectedImage = {
  contentType: PhotoContentType;
  extension: "jpg" | "png" | "webp";
  kind: PhotoKind;
  width: number;
  height: number;
};

const JPEG_SOI = [0xff, 0xd8, 0xff] as const;
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47] as const;

function startsWith(bytes: Uint8Array, sig: readonly number[]): boolean {
  if (bytes.length < sig.length) {
    return false;
  }
  return sig.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) {
    return false;
  }
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function u16be(bytes: Uint8Array, offset: number): number | undefined {
  const hi = bytes[offset];
  const lo = bytes[offset + 1];
  if (hi === undefined || lo === undefined) {
    return undefined;
  }
  return (hi << 8) | lo;
}

function u32be(bytes: Uint8Array, offset: number): number | undefined {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    return undefined;
  }
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function u24le(bytes: Uint8Array, offset: number): number | undefined {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  if (a === undefined || b === undefined || c === undefined) {
    return undefined;
  }
  return a | (b << 8) | (c << 16);
}

function isGif(bytes: Uint8Array): boolean {
  return asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a");
}

function isSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart();
  return head.startsWith("<svg") || head.startsWith("<?xml");
}

function isHeic(bytes: Uint8Array): boolean {
  if (!asciiAt(bytes, 4, "ftyp")) {
    return false;
  }
  const brands = new TextDecoder("latin1").decode(bytes.subarray(8, 24)).toLowerCase();
  return ["heic", "heif", "mif1", "msf1"].some((brand) => brands.includes(brand));
}

function parseJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) {
      return null;
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = u16be(bytes, offset + 2);
    if (length === undefined || length < 2) {
      return null;
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      const height = u16be(bytes, offset + 5);
      const width = u16be(bytes, offset + 7);
      if (!width || !height) {
        return null;
      }
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

function parsePngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || !asciiAt(bytes, 12, "IHDR")) {
    return null;
  }
  const width = u32be(bytes, 16);
  const height = u32be(bytes, 20);
  if (!width || !height) {
    return null;
  }
  return { width, height };
}

function findChunk(bytes: Uint8Array, name: string, from: number): number {
  let offset = from;
  while (offset + 8 <= bytes.length) {
    if (asciiAt(bytes, offset, name)) {
      return offset;
    }
    if (offset >= 12) {
      const chunkSize =
        (bytes[offset - 4] ?? 0) |
        ((bytes[offset - 3] ?? 0) << 8) |
        ((bytes[offset - 2] ?? 0) << 16) |
        ((bytes[offset - 1] ?? 0) << 24);
      if (chunkSize > 0 && chunkSize < bytes.length) {
        offset += 8 + chunkSize + (chunkSize % 2);
        continue;
      }
    }
    offset += 1;
  }
  return -1;
}

function parseWebp(bytes: Uint8Array): {
  width: number;
  height: number;
  hasAlpha: boolean;
} | null {
  if (bytes.length < 16 || !asciiAt(bytes, 0, "RIFF") || !asciiAt(bytes, 8, "WEBP")) {
    return null;
  }

  const vp8x = bytes.subarray(12, 16);
  if (asciiAt(vp8x, 0, "VP8X") && bytes.length >= 30) {
    const flags = bytes[20];
    const width = u24le(bytes, 24);
    const height = u24le(bytes, 27);
    if (flags === undefined || width === undefined || height === undefined) {
      return null;
    }
    return {
      width: width + 1,
      height: height + 1,
      hasAlpha: (flags & 0x10) !== 0,
    };
  }

  if (asciiAt(bytes, 12, "VP8 ") && bytes.length >= 30) {
    const start = 20;
    if (bytes[start + 3] === 0x9d && bytes[start + 4] === 0x01 && bytes[start + 5] === 0x2a) {
      const widthBits = u16be(bytes, start + 6);
      const heightBits = u16be(bytes, start + 8);
      if (!widthBits || !heightBits) {
        return null;
      }
      return { width: widthBits & 0x3fff, height: heightBits & 0x3fff, hasAlpha: false };
    }
  }

  if (asciiAt(bytes, 12, "VP8L") && bytes.length >= 25) {
    const bits =
      (bytes[21] ?? 0) |
      ((bytes[22] ?? 0) << 8) |
      ((bytes[23] ?? 0) << 16) |
      ((bytes[24] ?? 0) << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      hasAlpha: ((bits >> 28) & 1) === 1,
    };
  }

  const vp8xOffset = findChunk(bytes, "VP8X", 12);
  if (vp8xOffset >= 0 && vp8xOffset + 18 <= bytes.length) {
    const flags = bytes[vp8xOffset + 8];
    const width = u24le(bytes, vp8xOffset + 12);
    const height = u24le(bytes, vp8xOffset + 15);
    if (flags === undefined || width === undefined || height === undefined) {
      return null;
    }
    return {
      width: width + 1,
      height: height + 1,
      hasAlpha: (flags & 0x10) !== 0,
    };
  }

  return null;
}

export type ImageInspectError =
  | "payload_too_large"
  | "unsupported_media_type"
  | "invalid_dimensions";

export class ImageInspectFailure extends Error {
  readonly code: ImageInspectError;

  constructor(code: ImageInspectError) {
    super(code);
    this.name = "ImageInspectFailure";
    this.code = code;
  }
}

export function inspectImageBytes(bytes: Uint8Array): InspectedImage {
  if (bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new ImageInspectFailure("payload_too_large");
  }

  if (isGif(bytes) || isSvg(bytes) || isHeic(bytes)) {
    throw new ImageInspectFailure("unsupported_media_type");
  }

  if (startsWith(bytes, JPEG_SOI)) {
    const size = parseJpegSize(bytes);
    if (!size) {
      throw new ImageInspectFailure("invalid_dimensions");
    }
    assertLongEdge(size);
    return { contentType: "image/jpeg", extension: "jpg", kind: "photo", ...size };
  }

  if (startsWith(bytes, PNG_SIG)) {
    const size = parsePngSize(bytes);
    if (!size) {
      throw new ImageInspectFailure("invalid_dimensions");
    }
    assertLongEdge(size);
    return { contentType: "image/png", extension: "png", kind: "photo", ...size };
  }

  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) {
    const parsed = parseWebp(bytes);
    if (!parsed) {
      throw new ImageInspectFailure("invalid_dimensions");
    }
    assertLongEdge(parsed);
    return {
      contentType: "image/webp",
      extension: "webp",
      kind: parsed.hasAlpha ? "cutout" : "photo",
      width: parsed.width,
      height: parsed.height,
    };
  }

  throw new ImageInspectFailure("unsupported_media_type");
}

function assertLongEdge(size: { width: number; height: number }) {
  if (Math.max(size.width, size.height) > PHOTO_MAX_LONG_EDGE) {
    throw new ImageInspectFailure("invalid_dimensions");
  }
}
