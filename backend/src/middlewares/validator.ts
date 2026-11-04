import { Context, Next } from 'hono';

/**
 * Validasi nomor WhatsApp (format Indonesia: 08xxx atau 628xxx, 9-15 digit)
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^(08|628)\d{7,13}$/.test(clean);
}

/**
 * Validasi input form pendaftaran peserta
 */
export async function validatePendaftaran(c: Context, next: Next) {
  try {
    const body = await c.req.parseBody();
    const nama = (body['nama'] as string)?.trim();
    const no_whatsapp = (body['no_whatsapp'] as string)?.trim();
    const screenshot = body['screenshot'] as File | undefined;

    if (!nama || nama.length < 2) {
      return c.json({ error: 'Nama lengkap wajib diisi (minimal 2 karakter).' }, 400);
    }

    if (!no_whatsapp || !isValidIndonesianPhone(no_whatsapp)) {
      return c.json({
        error: 'Nomor WhatsApp tidak valid. Gunakan format nomor Indonesia (contoh: 08123456789).',
      }, 400);
    }

    if (!screenshot || typeof screenshot === 'string') {
      return c.json({ error: 'Bukti screenshot wajib diunggah.' }, 400);
    }

    // Validasi tipe file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(screenshot.type)) {
      return c.json({ error: 'Format screenshot harus JPG, PNG, atau WEBP.' }, 400);
    }

    // Validasi ukuran file (maks 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (screenshot.size > maxSize) {
      return c.json({ error: 'Ukuran file screenshot maksimal 2MB.' }, 400);
    }

    await next();
  } catch (err: any) {
    return c.json({ error: 'Format data pendaftaran tidak valid: ' + err.message }, 400);
  }
}
