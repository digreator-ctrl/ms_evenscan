/**
 * WhatsApp Link Builder Service
 * Membuat link wa.me dengan pesan pre-filled (GRATIS tanpa API berbayar)
 */

export class WALinkService {
  /**
   * Normalisasi nomor telepon ke format internasional (misal: 628123456789)
   */
  static normalizePhoneNumber(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  }

  /**
   * Membuat tautan wa.me lengkap dengan pesan template konfirmasi
   */
  static generateLink(params: {
    phoneNumber: string;
    namaPeserta: string;
    siteUrl: string;
    namaAcara?: string;
  }): string {
    const { phoneNumber, namaPeserta, siteUrl, namaAcara = 'Muslim Scene Event' } = params;
    const cleanPhone = this.normalizePhoneNumber(phoneNumber);
    const cekStatusUrl = `${siteUrl.replace(/\/$/, '')}/status`;

    const pesan = `Assalamu'alaikum Kak *${namaPeserta}*,

Pendaftaran Anda untuk acara *${namaAcara}* telah *BERHASIL DIKONFIRMASI* ✅

Silakan akses & unduh QR code kehadiran Anda melalui tautan berikut:
🔗 ${cekStatusUrl}

*(Masukkan nomor WhatsApp Anda: ${phoneNumber} pada halaman tersebut untuk melihat & download QR code)*

Mohon simpan dan tunjukkan QR code ini kepada panitia di meja registrasi pada hari acara.

Jazakumullah khairan katsiran 🤲
_Panitia ${namaAcara}_`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pesan)}`;
  }
}
