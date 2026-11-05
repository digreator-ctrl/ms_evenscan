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
  const jenis_kelamin = ((body['jenis_kelamin'] as string) || '').trim();
  const nip = ((body['nip'] as string) || '').trim();
  const domisili = ((body['domisili'] as string) || '').trim();
  const alasan = ((body['alasan'] as string) || '').trim();
  const instansi = ((body['instansi'] as string) || (nip ? `${jenis_kelamin ? jenis_kelamin + ' | ' : ''}NIP: ${nip}${domisili ? ' | ' + domisili : ''}` : '')).trim();
  const screenshot = body['screenshot'] as File;

  // Cek duplikasi pendaftaran aktif (status 'menunggu', 'dikonfirmasi', atau 'hadir')
  const [phone62, phone08] = getPhoneVariants(no_whatsapp);
  try {
    const existing = await db
      .prepare(
        `SELECT id, nama, status FROM pendaftar 
         WHERE (no_whatsapp = ? OR no_whatsapp = ?) 
           AND status != 'ditolak'
         LIMIT 1`
      )
      .bind(phone62, phone08)
      .first<{ id: string; nama: string; status: string }>();

    if (existing) {
      if (existing.status === 'menunggu') {
        return c.json(
          {
            success: true,
            id: existing.id,
            nama: existing.nama,
            message: 'Pendaftaran Anda sudah kami terima sebelumnya dan sedang dalam antrean verifikasi panitia.',
          },
          200
        );
      }
      if (existing.status === 'dikonfirmasi' || existing.status === 'hadir') {
        return c.json(
          {
            error: 'Nomor WhatsApp ini sudah terdaftar dan statusnya telah dikonfirmasi. Silakan buka menu Cek Tiket untuk melihat QR Code Anda.',
          },
          409
        );
      }
    }
  } catch (checkErr) {
    console.warn('Pengecekan duplikasi pendaftar dilewati:', checkErr);
  }

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
    try {
      await db
        .prepare(
          `INSERT INTO pendaftar (id, nama, email, no_whatsapp, instansi, jenis_kelamin, nip, domisili, alasan, screenshot_url, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu')`
        )
        .bind(id, nama, email, no_whatsapp, instansi, jenis_kelamin, nip, domisili, alasan, screenshotUrl)
        .run();
    } catch {
      // Fallback jika skema database lokal belum menambahkan kolom baru
      await db
        .prepare(
          `INSERT INTO pendaftar (id, nama, email, no_whatsapp, instansi, screenshot_url, status)
           VALUES (?, ?, ?, ?, ?, ?, 'menunggu')`
        )
        .bind(id, nama, email, no_whatsapp, instansi, screenshotUrl)
        .run();
    }

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
 * GET /api/peserta/status?nip=...&wa4=...
 * Atau fallback: ?wa=08xxxxxxxx
 * Cek status pendaftaran dan akses QR Code mandiri
 */
pesertaRoutes.get('/status', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const nip = c.req.query('nip')?.trim();
  const wa4 = c.req.query('wa4')?.trim();
  const wa = c.req.query('wa')?.trim();

  if (!nip && !wa4 && !wa) {
    return c.json({ error: 'Parameter NIP dan 4 digit terakhir WhatsApp (?nip=...&wa4=...) diperlukan' }, 400);
  }

  try {
    let record: {
      id: string;
      nama: string;
      email: string;
      no_whatsapp: string;
      instansi: string;
      nip?: string;
      status: string;
      qr_token: string | null;
      alasan_tolak: string | null;
      created_at: string;
      confirmed_at: string | null;
      attended_at: string | null;
    } | null = null;

    if (nip && wa4) {
      const nipParam = nip.toUpperCase();
      const wa4Digits = wa4.replace(/\D/g, '');

      if (wa4Digits.length !== 4) {
        return c.json({ error: '4 digit nomor WhatsApp harus berupa 4 angka' }, 400);
      }

      record = await db
        .prepare(
          `SELECT id, nama, email, no_whatsapp, instansi, nip, status, qr_token, alasan_tolak, created_at, confirmed_at, attended_at
           FROM pendaftar
           WHERE (
             UPPER(COALESCE(nip, '')) = ?
             OR UPPER(instansi) LIKE ?
             OR UPPER(instansi) LIKE ?
           )
           AND (
             substr(replace(replace(replace(no_whatsapp, ' ', ''), '-', ''), '+', ''), -4) = ?
             OR no_whatsapp LIKE ?
           )
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .bind(
          nipParam,
          `%NIP: ${nipParam}%`,
          `%${nipParam}%`,
          wa4Digits,
          `%${wa4Digits}`
        )
        .first();
    } else if (wa) {
      // Fallback kompatibilitas dengan nomor WA utuh
      const [var1, var2] = getPhoneVariants(wa);
      record = await db
        .prepare(
          `SELECT id, nama, email, no_whatsapp, instansi, nip, status, qr_token, alasan_tolak, created_at, confirmed_at, attended_at
           FROM pendaftar
           WHERE no_whatsapp = ? OR no_whatsapp = ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .bind(var1, var2)
        .first();
    } else if (nip && !wa4) {
      return c.json({ error: 'Harap masukkan juga 4 digit terakhir nomor WhatsApp terdaftar' }, 400);
    } else if (!nip && wa4) {
      return c.json({ error: 'Harap masukkan NIP terdaftar Anda' }, 400);
    }

    if (!record) {
      return c.json({ error: 'Data pendaftar dengan NIP dan 4 digit terakhir nomor WhatsApp tersebut tidak ditemukan' }, 404);
    }

    return c.json({
      id: record.id,
      nama: record.nama,
      email: record.email,
      no_whatsapp: record.no_whatsapp,
      instansi: record.instansi,
      nip: record.nip,
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
 * Menghasilkan & mengirimkan file gambar QR code kehadiran peserta (PNG / SVG murni)
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

    const format = c.req.query('format') || 'png';

    if (format === 'svg') {
      const svgString = await QRGeneratorService.generateSVG(token);
      return new Response(svgString, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
          'Content-Disposition': `inline; filename="qr-${token}.svg"`,
        },
      });
    }

    // Generate gambar PNG murni (pure JS, tanpa canvas)
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
    // Fallback otomatis ke SVG jika terjadi kendala
    try {
      const svgFallback = await QRGeneratorService.generateSVG(token);
      return new Response(svgFallback, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
          'Content-Disposition': `inline; filename="qr-${token}.svg"`,
        },
      });
    } catch {
      return c.json({ error: 'Gagal memproses QR code: ' + err.message }, 500);
    }
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
