function u16be(value: number): [number, number] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32be(value: number): [number, number, number, number] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u24le(value: number): [number, number, number] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}

function u32le(value: number): [number, number, number, number] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}

/** 寸法だけ正しい最低限の JPEG（SOF0）。デコーダは不要。 */
export function makeJpeg(width: number, height: number, extraBytes = 0): Uint8Array {
  const sof = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    ...u16be(height),
    ...u16be(width),
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
  ];
  const app0 = [
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ];
  const bytes = [0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9, ...new Array(extraBytes).fill(0)];
  return Uint8Array.from(bytes);
}

export function makePng(width: number, height: number): Uint8Array {
  const ihdr = [
    ...u32be(13),
    0x49,
    0x48,
    0x44,
    0x52,
    ...u32be(width),
    ...u32be(height),
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr]);
}

export function makeWebpVp8x(input: { width: number; height: number; alpha: boolean }): Uint8Array {
  const payload = [
    input.alpha ? 0x10 : 0x00,
    0x00,
    0x00,
    0x00,
    ...u24le(input.width - 1),
    ...u24le(input.height - 1),
  ];
  const chunk = [0x56, 0x50, 0x38, 0x58, ...u32le(payload.length), ...payload];
  const riffSize = 4 + chunk.length;
  return Uint8Array.from([
    0x52,
    0x49,
    0x46,
    0x46,
    ...u32le(riffSize),
    0x57,
    0x45,
    0x42,
    0x50,
    ...chunk,
  ]);
}

export function makeGif(): Uint8Array {
  return Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
}

export function makeSvg(): Uint8Array {
  return new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
}

export function makeHeic(): Uint8Array {
  return Uint8Array.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
    0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63,
  ]);
}
