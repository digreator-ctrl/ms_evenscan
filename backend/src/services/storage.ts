/**
 * Storage Service — Integrasi Cloudflare R2
 * Mengelola penyimpanan file bukti screenshot & QR code
 */

export class StorageService {
  constructor(private bucket?: R2Bucket) {}

  /**
   * Upload file ke R2 bucket
   */
  async upload(
    key: string,
    data: ArrayBuffer | Uint8Array | ReadableStream,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    if (!this.bucket) {
      console.warn('Storage bucket tidak tersedia (unbound), melewatkan upload R2.');
      return key;
    }

    await this.bucket.put(key, data, {
      httpMetadata: {
        contentType,
      },
    });

    return key;
  }

  /**
   * Mengambil file dari R2 bucket
   */
  async get(key: string): Promise<R2ObjectBody | null> {
    if (!this.bucket) {
      return null;
    }

    const object = await this.bucket.get(key);
    return object;
  }

  /**
   * Menghapus file dari R2 bucket
   */
  async delete(key: string): Promise<void> {
    if (!this.bucket) return;
    await this.bucket.delete(key);
  }
}
