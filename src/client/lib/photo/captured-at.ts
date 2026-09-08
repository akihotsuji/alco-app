import { isDrunkAtAllowed } from "@/shared/drink-logs.ts";
import { parseCalendarDate, tokyoLocalToIso, tokyoToday } from "@/shared/tokyo-date.ts";

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] as const;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TYPE_ASCII = 2;
const TYPE_LONG = 4;

const EXIF_DATETIME_RE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/;

function viewAt(bytes: Uint8Array, offset: number, length: number): DataView | null {
  if (offset < 0 || offset + length > bytes.byteLength) {
    return null;
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, length);
}

function readU16(view: DataView, offset: number, little: boolean): number {
  return little ? view.getUint16(offset, true) : view.getUint16(offset, false);
}

function readU32(view: DataView, offset: number, little: boolean): number {
  return little ? view.getUint32(offset, true) : view.getUint32(offset, false);
}

function readAscii(bytes: Uint8Array, offset: number, count: number): string | null {
  if (offset < 0 || count < 1 || offset + count > bytes.byteLength) {
    return null;
  }
  let text = "";
  for (let i = 0; i < count; i += 1) {
    const code = bytes[offset + i];
    if (code === undefined || code === 0) {
      break;
    }
    text += String.fromCharCode(code);
  }
  return text.length > 0 ? text : null;
}

type IfdEntry = { tag: number; type: number; count: number; value: number };

function readIfd(
  bytes: Uint8Array,
  tiffOffset: number,
  ifdOffset: number,
  little: boolean,
): IfdEntry[] {
  const header = viewAt(bytes, tiffOffset + ifdOffset, 2);
  if (!header) {
    return [];
  }
  const count = readU16(header, 0, little);
  const size = 2 + count * 12;
  const table = viewAt(bytes, tiffOffset + ifdOffset, size);
  if (!table) {
    return [];
  }
  const entries: IfdEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = 2 + i * 12;
    entries.push({
      tag: readU16(table, base, little),
      type: readU16(table, base + 2, little),
      count: readU32(table, base + 4, little),
      value: readU32(table, base + 8, little),
    });
  }
  return entries;
}

function asciiFromEntry(bytes: Uint8Array, tiffOffset: number, entry: IfdEntry): string | null {
  if (entry.type !== TYPE_ASCII || entry.count < 1) {
    return null;
  }
  // DateTime は 20 バイトなので常にオフセット参照
  const dataOffset = entry.count <= 4 ? null : tiffOffset + entry.value;
  if (dataOffset === null) {
    return null;
  }
  return readAscii(bytes, dataOffset, entry.count);
}

function parseExifDateTime(raw: string): string | null {
  const matched = EXIF_DATETIME_RE.exec(raw);
  if (!matched) {
    return null;
  }
  const local = `${matched[1]}-${matched[2]}-${matched[3]}T${matched[4]}:${matched[5]}:${matched[6]}`;
  return tokyoLocalToIso(local);
}

function findApp1Exif(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined || marker === 0xda || marker === 0xd9) {
      break;
    }
    const lengthView = viewAt(bytes, offset + 2, 2);
    if (!lengthView) {
      break;
    }
    const length = lengthView.getUint16(0, false);
    if (length < 2 || offset + 2 + length > bytes.length) {
      break;
    }
    if (marker === 0xe1) {
      const payload = bytes.subarray(offset + 4, offset + 2 + length);
      if (payload.length > 6 && EXIF_HEADER.every((value, index) => payload[index] === value)) {
        return payload.subarray(6);
      }
    }
    offset += 2 + length;
  }
  return null;
}

export function readJpegExifCapturedAt(bytes: Uint8Array): string | null {
  const tiff = findApp1Exif(bytes);
  if (!tiff || tiff.length < 8) {
    return null;
  }
  const header = viewAt(tiff, 0, 8);
  if (!header) {
    return null;
  }
  const little = header.getUint16(0, false) === 0x4949;
  if (!little && header.getUint16(0, false) !== 0x4d4d) {
    return null;
  }
  if (readU16(header, 2, little) !== 0x002a) {
    return null;
  }
  const ifd0Offset = readU32(header, 4, little);
  const ifd0 = readIfd(tiff, 0, ifd0Offset, little);
  let exifIfdOffset: number | null = null;
  let dateTime: string | null = null;
  for (const entry of ifd0) {
    if (entry.tag === TAG_EXIF_IFD && entry.type === TYPE_LONG) {
      exifIfdOffset = entry.value;
    }
    if (entry.tag === TAG_DATETIME) {
      dateTime = asciiFromEntry(tiff, 0, entry);
    }
  }
  let original: string | null = null;
  let digitized: string | null = null;
  if (exifIfdOffset !== null) {
    for (const entry of readIfd(tiff, 0, exifIfdOffset, little)) {
      if (entry.tag === TAG_DATETIME_ORIGINAL) {
        original = asciiFromEntry(tiff, 0, entry);
      }
      if (entry.tag === TAG_DATETIME_DIGITIZED) {
        digitized = asciiFromEntry(tiff, 0, entry);
      }
    }
  }
  const raw = original ?? digitized ?? dateTime;
  return raw ? parseExifDateTime(raw) : null;
}

export async function capturedAtFromFile(file: File): Promise<string | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const exif = readJpegExifCapturedAt(bytes);
    if (exif) {
      return exif;
    }
  } catch {
    // 壊れたファイルは lastModified へ
  }
  if (!Number.isFinite(file.lastModified) || file.lastModified <= 0) {
    return null;
  }
  return new Date(file.lastModified).toISOString();
}

/** 記録の未来は +15 分ルールでいまにクランプ */
export function capturedAtToDrunkAt(capturedAt: string, now: Date): string {
  const instant = new Date(capturedAt);
  if (Number.isNaN(instant.getTime()) || !isDrunkAtAllowed(instant, now)) {
    return now.toISOString();
  }
  return instant.toISOString();
}

/** ノート / セラーのカレンダー日。未来なら今日 */
export function capturedAtToCalendarDate(capturedAt: string, now: Date): string {
  const instant = new Date(capturedAt);
  if (Number.isNaN(instant.getTime())) {
    return tokyoToday(now);
  }
  const day = tokyoToday(instant);
  const today = tokyoToday(now);
  return day > today ? today : day;
}

export function shouldKeepQueryDrunkAt(dateParam: string | null | undefined, now: Date): boolean {
  return Boolean(dateParam && parseCalendarDate(dateParam) && dateParam < tokyoToday(now));
}
