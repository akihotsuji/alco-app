/** PNG の RGBA 展開と再エンコード。8bit・非インターレースだけ扱う。Worker の CompressionStream を使う。 */

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function asBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    const tableValue = CRC_TABLE[(value ^ byte) & 0xff] ?? 0;
    value = (tableValue ^ (value >>> 8)) >>> 0;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([asBlobPart(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([asBlobPart(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readU32(bytes: Uint8Array, offset: number): number {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    throw new Error("png truncated");
  }
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distLeft = Math.abs(estimate - left);
  const distUp = Math.abs(estimate - up);
  const distUpLeft = Math.abs(estimate - upLeft);
  if (distLeft <= distUp && distLeft <= distUpLeft) {
    return left;
  }
  if (distUp <= distUpLeft) {
    return up;
  }
  return upLeft;
}

function unfilter(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  let source = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[source];
    source += 1;
    if (filter === undefined) {
      throw new Error("png filter missing");
    }
    const dest = row * stride;
    const prev = row === 0 ? null : out.subarray((row - 1) * stride, row * stride);
    for (let column = 0; column < stride; column += 1) {
      const sample = raw[source + column];
      if (sample === undefined) {
        throw new Error("png scanline truncated");
      }
      const left = column >= bpp ? (out[dest + column - bpp] ?? 0) : 0;
      const up = prev?.[column] ?? 0;
      const upLeft = prev && column >= bpp ? (prev[column - bpp] ?? 0) : 0;
      let value = sample;
      if (filter === 1) {
        value = (sample + left) & 0xff;
      } else if (filter === 2) {
        value = (sample + up) & 0xff;
      } else if (filter === 3) {
        value = (sample + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        value = (sample + paethPredictor(left, up, upLeft)) & 0xff;
      } else if (filter !== 0) {
        throw new Error("png filter unsupported");
      }
      out[dest + column] = value;
    }
    source += stride;
  }
  return out;
}

function expandToRgba(
  samples: Uint8Array,
  width: number,
  height: number,
  colorType: number,
  palette: Uint8Array | null,
  transparency: Uint8Array | null,
): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  if (colorType === 6) {
    out.set(samples);
    return out;
  }
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const dest = pixel * 4;
    if (colorType === 2) {
      const source = pixel * 3;
      out[dest] = samples[source] ?? 0;
      out[dest + 1] = samples[source + 1] ?? 0;
      out[dest + 2] = samples[source + 2] ?? 0;
      out[dest + 3] = 255;
      if (transparency && transparency.byteLength >= 6) {
        const red = ((transparency[0] ?? 0) << 8) | (transparency[1] ?? 0);
        const green = ((transparency[2] ?? 0) << 8) | (transparency[3] ?? 0);
        const blue = ((transparency[4] ?? 0) << 8) | (transparency[5] ?? 0);
        if (
          (samples[source] ?? 0) === red >> 8 &&
          (samples[source + 1] ?? 0) === green >> 8 &&
          (samples[source + 2] ?? 0) === blue >> 8
        ) {
          out[dest + 3] = 0;
        }
      }
      continue;
    }
    if (colorType === 0) {
      const gray = samples[pixel] ?? 0;
      out[dest] = gray;
      out[dest + 1] = gray;
      out[dest + 2] = gray;
      out[dest + 3] = 255;
      if (transparency && transparency.byteLength >= 2) {
        const key = ((transparency[0] ?? 0) << 8) | (transparency[1] ?? 0);
        if (gray === key >> 8) {
          out[dest + 3] = 0;
        }
      }
      continue;
    }
    if (colorType === 4) {
      const source = pixel * 2;
      const gray = samples[source] ?? 0;
      out[dest] = gray;
      out[dest + 1] = gray;
      out[dest + 2] = gray;
      out[dest + 3] = samples[source + 1] ?? 0;
      continue;
    }
    if (colorType === 3 && palette) {
      const index = samples[pixel] ?? 0;
      out[dest] = palette[index * 3] ?? 0;
      out[dest + 1] = palette[index * 3 + 1] ?? 0;
      out[dest + 2] = palette[index * 3 + 2] ?? 0;
      out[dest + 3] = transparency?.[index] ?? 255;
      continue;
    }
    throw new Error("png color type unsupported");
  }
  return out;
}

export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

export async function decodePngToRgba(bytes: Uint8Array): Promise<RgbaImage> {
  if (bytes.byteLength < 8 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error("png signature");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  while (offset + 12 <= bytes.byteLength) {
    const length = readU32(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0,
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.byteLength) {
      throw new Error("png chunk truncated");
    }
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      width = readU32(data, 0);
      height = readU32(data, 4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "PLTE") {
      palette = data.slice();
    } else if (type === "tRNS") {
      transparency = data.slice();
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  if (width < 1 || height < 1 || bitDepth !== 8 || interlace !== 0) {
    throw new Error("png dimensions unsupported");
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const inflated = await inflateZlib(concatBytes(idat));
  const samples = unfilter(inflated, width, height, bpp);
  return {
    width,
    height,
    data: expandToRgba(samples, width, height, colorType, palette, transparency),
  };
}

function writeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(4 + data.byteLength);
  body.set(typeBytes);
  body.set(data, 4);
  const out = new Uint8Array(12 + data.byteLength);
  writeU32(out, 0, data.byteLength);
  out.set(body, 4);
  writeU32(out, 8 + data.byteLength, crc32(body));
  return out;
}

export async function encodeRgbaToPng(image: RgbaImage): Promise<Uint8Array> {
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, image.width);
  writeU32(ihdr, 4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = image.width * 4;
  const raw = new Uint8Array((stride + 1) * image.height);
  for (let row = 0; row < image.height; row += 1) {
    const dest = row * (stride + 1);
    raw[dest] = 0;
    raw.set(image.data.subarray(row * stride, (row + 1) * stride), dest + 1);
  }
  const compressed = await deflateZlib(raw);
  return concatBytes([
    PNG_SIGNATURE,
    writeChunk("IHDR", ihdr),
    writeChunk("IDAT", compressed),
    writeChunk("IEND", new Uint8Array()),
  ]);
}
