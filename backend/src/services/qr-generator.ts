import QRCode from 'qrcode';

/**
 * QR Code Generator Service
 * Generate QR code unik per peserta untuk validasi kehadiran
 */
export class QRGeneratorService {
  /**
   * Menghasilkan QR code dalam bentuk PNG ArrayBuffer/Uint8Array
   * Payload QR berisi token unik kehadiran
   */
  static async generatePNG(token: string): Promise<Uint8Array> {
    // Generate data URL (data:image/png;base64,...)
    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#07407b', // Muslim Scene Ocean Blue
        light: '#ffffff',
      },
    });

    // Ambil bagian base64 setelah koma
    const base64Data = dataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Menghasilkan QR code dalam bentuk SVG string
   */
  static async generateSVG(token: string): Promise<string> {
    return await QRCode.toString(token, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#14532d',
        light: '#ffffff',
      },
    });
  }
}
