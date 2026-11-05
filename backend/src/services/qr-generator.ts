import QRCode from 'qrcode';

function crc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const chunk = new Uint8Array(4 + 4 + len + 4);
  const v = new DataView(chunk.buffer);
  v.setUint32(0, len);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  v.setUint32(8 + len, crc);
  return chunk;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const res = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    res.set(c, offset);
    offset += c.length;
  }
  return res;
}

/**
 * QR Code Generator Service
 * Pure JavaScript - aman digunakan di Cloudflare Workers (tanpa canvas / DOM)
 */
export class QRGeneratorService {
  /**
   * Menghasilkan QR code dalam bentuk PNG Uint8Array tanpa menggunakan Canvas / DOM
   */
  static async generatePNG(token: string): Promise<Uint8Array> {
    const qr = QRCode.create(token, { errorCorrectionLevel: 'M' });
    const margin = 2;
    const scale = 10;
    const size = qr.modules.size;
    const totalSize = (size + margin * 2) * scale;
    const rowBytes = 1 + totalSize * 3;
    const rawData = new Uint8Array(rowBytes * totalSize);

    const dark = [6, 48, 93]; // #06305d Muslim Scene Ocean Navy
    const light = [255, 255, 255]; // #ffffff Putih

    for (let y = 0; y < totalSize; y++) {
      const rowStart = y * rowBytes;
      rawData[rowStart] = 0; // Filter Type: None
      const moduleY = Math.floor(y / scale) - margin;
      for (let x = 0; x < totalSize; x++) {
        const moduleX = Math.floor(x / scale) - margin;
        const isDark =
          moduleY >= 0 && moduleY < size && moduleX >= 0 && moduleX < size
            ? qr.modules.get(moduleY, moduleX)
            : 0;
        const color = isDark ? dark : light;
        const offset = rowStart + 1 + x * 3;
        rawData[offset] = color[0];
        rawData[offset + 1] = color[1];
        rawData[offset + 2] = color[2];
      }
    }

    const compressed = await deflate(rawData);

    // IHDR chunk: width (4), height (4), bitDepth: 8 (1), colorType: 2 RGB (1), comp: 0, filter: 0, interlace: 0
    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, totalSize);
    ihdrView.setUint32(4, totalSize);
    ihdrData[8] = 8; // 8 bits per sample
    ihdrData[9] = 2; // Color type 2: Truecolor RGB
    ihdrData[10] = 0; // Default compression
    ihdrData[11] = 0; // Default filter
    ihdrData[12] = 0; // No interlace

    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrChunk = createChunk('IHDR', ihdrData);
    const idatChunk = createChunk('IDAT', compressed);
    const iendChunk = createChunk('IEND', new Uint8Array(0));

    const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    const png = new Uint8Array(totalLength);
    let p = 0;
    png.set(signature, p); p += signature.length;
    png.set(ihdrChunk, p); p += ihdrChunk.length;
    png.set(idatChunk, p); p += idatChunk.length;
    png.set(iendChunk, p); p += iendChunk.length;

    return png;
  }

  /**
   * Menghasilkan QR code dalam bentuk SVG string murni (vektor)
   */
  static async generateSVG(token: string): Promise<string> {
    return await QRCode.toString(token, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#06305d',
        light: '#ffffff',
      },
    });
  }
}
