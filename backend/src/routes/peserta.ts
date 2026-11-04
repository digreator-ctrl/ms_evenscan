import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { validatePendaftaran } from '../middlewares/validator';
import { StorageService } from '../services/storage';
import { QRGeneratorService } from '../services/qr-generator';

type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
};

export const pesertaRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Helper untuk normalisasi nomor telepon
 */
function getPhoneVariants(phone: string): [string, string] {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) {
    return [digits, '0' + digits.slice(2)];
  }
  if (digits.startsWith('0')) {
    return ['62' + digits.slice(1), digits];
  }
  return ['62' + digits, '0' + digits];
}

/**
 * POST /api/peserta/daftar
 * Menerima formulir pendaftaran + file screenshot bukti
 */
pesertaRoutes.post('/daftar', validatePendaftaran, async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const storage = new StorageService(c.env.STORAGE);
  const body = await c.req.parseBody();

  const nama = (body['nama'] as string).trim();
  const email = ((body['email'] as string) || '').trim();
  const no_whatsapp = (body['no_whatsapp'] as string).trim();
  const instansi = ((body['instansi'] as string) || '').trim();
  const screenshot = body['screenshot'] as File;

  const id = 'reg_' + nanoid(10);

  // Ambil ekstensi file
  const mime = screenshot.type;
  let ext = 'jpg';
  if (mime === 'image/png') ext = 'png';
  else if (mime === 'image/webp') ext = 'webp';

  const storageKey = `screenshots/${id}.${ext}`;

  try {
    // 1. Upload screenshot ke R2
    const fileBuffer = await screenshot.arrayBuffer();
    await storage.upload(storageKey, fileBuffer, mime);

    // URL screenshot (relatif ke API agar bisa diakses lewat /api/peserta/screenshot/:key)
    const screenshotUrl = `/api/peserta/screenshot/${encodeURIComponent(storageKey)}`;

    // 2. Simpan record ke Cloudflare D1
    await db
      .prepare(
        `INSERT INTO pendaftar (id, nama, email, no_whatsapp, instansi, screenshot_url, status)
         VALUES (?, ?, ?, ?, ?, ?, 'menunggu')`
      )
      .bind(id, nama, email, no_whatsapp, instansi, screenshotUrl)
      .run();

    return c.json(
      {
        success: true,
        id,
        nama,
        message: 'Pendaftaran Anda berhasil dikirim dan sedang menunggu verifikasi panitia.',
      },
      201
    );
  } catch (err: any) {
    console.error('Error saat pendaftaran:', err);
    return c.json({ error: 'Gagal memproses pendaftaran: ' + err.message }, 500);
  }
});

/**
 * GET /api/peserta/status?wa=08xxxxxxxx
 * Cek status pendaftaran dan akses QR Code mandiri
 */
pesertaRoutes.get('/status', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const wa = c.req.query('wa');
  if (!wa) {
    return c.json({ error: 'Parameter nomor WhatsApp (?wa=...) diperlukan' }, 400);
  }

  const [var1, var2] = getPhoneVariants(wa);

  try {
    const record = await db
      .prepare(
        `SELECT id, nama, email, no_whatsapp, instansi, status, qr_token, alasan_tolak, created_at, confirmed_at, attended_at
         FROM pendaftar
         WHERE no_whatsapp = ? OR no_whatsapp = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(var1, var2)
      .first<{
        id: string;
        nama: string;
        email: string;
        no_whatsapp: string;
        instansi: string;
        status: string;
        qr_token: string | null;
        alasan_tolak: string | null;
        created_at: string;
        confirmed_at: string | null;
        attended_at: string | null;
      }>();

    if (!record) {
      return c.json({ error: 'Nomor WhatsApp tidak terdaftar' }, 404);
    }

    return c.json({
      id: record.id,
      nama: record.nama,
      email: record.email,
      no_whatsapp: record.no_whatsapp,
      instansi: record.instansi,
      status: record.status,
      qr_token: record.qr_token,
      alasan_tolak: record.alasan_tolak,
      created_at: record.created_at,
      confirmed_at: record.confirmed_at,
      attended_at: record.attended_at,
    });
  } catch (err: any) {
    console.error('Error cek status:', err);
    return c.json({ error: 'Gagal mengambil status: ' + err.message }, 500);
  }
});

/**
 * GET /api/peserta/qr/:token
 * Menghasilkan & mengirimkan file gambar QR code kehadiran peserta (PNG)
 */
pesertaRoutes.get('/qr/:token', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const token = c.req.param('token');
  if (!token) {
    return c.json({ error: 'Token tidak valid' }, 400);
  }

  try {
    const record = await db
      .prepare(`SELECT id, nama, status, qr_token FROM pendaftar WHERE qr_token = ?`)
      .bind(token)
      .first();

    if (!record || (record.status !== 'dikonfirmasi' && record.status !== 'hadir')) {
      return c.json({ error: 'QR Code tidak ditemukan atau belum disetujui panitia' }, 404);
    }

    // Generate gambar PNG
    const pngBytes = await QRGeneratorService.generatePNG(token);

    return new Response(pngBytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Content-Disposition': `inline; filename="qr-${token}.png"`,
      },
    });
  } catch (err: any) {
    console.error('Error generate QR:', err);
    return c.json({ error: 'Gagal memproses QR code: ' + err.message }, 500);
  }
});

/**
 * GET /api/peserta/screenshot/:key
 * Mengambil file gambar bukti screenshot yang tersimpan di Cloudflare R2
 */
pesertaRoutes.get('/screenshot/:key{.+}', async (c) => {
  const storage = new StorageService(c.env.STORAGE);
  const key = c.req.param('key');

  try {
    const file = await storage.get(key);
    if (!file) {
      return c.json({ error: 'File screenshot tidak ditemukan di storage' }, 404);
    }

    const contentType = file.httpMetadata?.contentType || 'image/jpeg';

    return new Response(file.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('Error mengambil file R2:', err);
    return c.json({ error: 'Gagal memuat gambar: ' + err.message }, 500);
  }
});

/**
 * GET /api/peserta/:id
 * Detail data pendaftar by ID
 */
pesertaRoutes.get('/:id', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const id = c.req.param('id');
  const record = await db
    .prepare(
      `SELECT id, nama, email, no_whatsapp, instansi, screenshot_url, qr_token, status, created_at
       FROM pendaftar WHERE id = ?`
    )
    .bind(id)
    .first();

  if (!record) {
    return c.json({ error: 'Data pendaftar tidak ditemukan' }, 404);
  }

  return c.json(record);
});
