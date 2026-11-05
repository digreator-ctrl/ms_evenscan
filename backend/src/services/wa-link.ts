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
    jenisKelamin?: string;
    nip?: string;
  }): string {
    const { phoneNumber, namaPeserta, siteUrl, namaAcara = 'Muslim Scene Event', jenisKelamin, nip } = params;
    const cleanPhone = this.normalizePhoneNumber(phoneNumber);

    const nipStr = (nip || '').trim();
    const matchNip = nipStr.match(/NIP:\s*([A-Za-z0-9\-\/]+)/i);
    const nipVal = matchNip ? matchNip[1].trim() : (nipStr !== '-' ? nipStr : '');
    const nipUpper = nipVal.toUpperCase();

    const isIkhwan = jenisKelamin?.toLowerCase() === 'ikhwan' || nipUpper.startsWith('ARN');
    const isAkhwat = jenisKelamin?.toLowerCase() === 'akhwat' || nipUpper.startsWith('ART');
    const sapaan = isIkhwan ? 'Bapak/Mas' : isAkhwat ? 'Ibu/Mbak' : 'Bapak/Ibu/Mas/Mbak';

    const wa4 = cleanPhone.slice(-4);
    const kodeAkses = `${nipVal}${wa4}`;

    const pesan = `بسم الله
السلام عليكم ورحمة الله وبركاته
 Selamat Datang ${sapaan} ${namaPeserta},

Pendaftaran Anda untuk acara *${namaAcara}* telah *BERHASIL DIKONFIRMASI* ✅

Silakan akses & unduh QR code kehadiran Anda melalui tautan berikut:
🔗 https://ms-evenscan-peserta.pages.dev/status

*${kodeAkses}*

_*Masukkan kode akses pada halaman tersebut untuk melihat & download QR code*_

Mohon simpan dan tunjukkan QR code ini kepada panitia di meja registrasi pada hari acara.

جزاكم الله خيرا
_Panitia ${namaAcara}_`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pesan)}`;
  }
}
