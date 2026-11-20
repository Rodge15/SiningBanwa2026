import zlib from "node:zlib";
import { code128Runs } from "@/lib/code128";

// Builds a PNG image (as a Buffer) of a Code 128 barcode for `value`.
// Grayscale, no dependencies. Suitable for attaching to emails by CID.

const CRC_TABLE = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export function code128Png(value, { height = 70, moduleWidth = 2, margin = 12 } = {}) {
  const runs = code128Runs(value);
  if (!runs) {
    return null;
  }

  const barsWidth = runs.reduce((sum, run) => sum + run, 0) * moduleWidth;
  const width = barsWidth + margin * 2;

  // One row of grayscale pixels (0 = black bar, 255 = white).
  const row = Buffer.alloc(width, 255);
  let x = margin;
  let isBar = true;
  for (const run of runs) {
    const runPx = run * moduleWidth;
    if (isBar) {
      row.fill(0, x, x + runPx);
    }
    x += runPx;
    isBar = !isBar;
  }

  // Raw image: each scanline is a filter byte (0) followed by the row pixels.
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (width + 1);
    raw[offset] = 0;
    row.copy(raw, offset + 1);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}