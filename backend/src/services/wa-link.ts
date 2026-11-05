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

    const pesan = `بسم الله
السلام عليكم ورحمة الله وبركاته
 Selamat Datang Bapak/Ibu/Mas/Mbak ${namaPeserta},

Pendaftaran Anda untuk acara *${namaAcara}* telah *BERHASIL DIKONFIRMASI* ✅

Silakan akses & unduh QR code kehadiran Anda melalui tautan berikut:
🔗 https://ms-evenscan-admin.pages.dev/status

(NIP + 4 digit terakhir no WA)

_*Masukkan kode akses pada halaman tersebut untuk melihat & download QR code*_

Mohon simpan dan tunjukkan QR code ini kepada panitia di meja registrasi pada hari acara.

جزاكم الله خيرا
_Panitia ${namaAcara}_`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pesan)}`;
  }
}
