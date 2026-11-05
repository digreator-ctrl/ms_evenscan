import { Hono } from 'hono';
import { authMiddleware } from '../middlewares/auth';

type Bindings = {
  DB: D1Database;
};

export const absensiRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/absensi/stats
 * Rekap statistik pendaftaran & kehadiran untuk dashboard admin
 */
absensiRoutes.get('/stats', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({
      total: 0,
      menunggu: 0,
      dikonfirmasi: 0,
      ditolak: 0,
      hadir: 0,
      sudah_hadir: 0,
      belum_hadir: 0,
      persentase_kehadiran: 0,
    });
  }

  try {
    const stats = await db
      .prepare(
        `SELECT
           COUNT(*) as total,
           COALESCE(SUM(CASE WHEN status = 'menunggu' THEN 1 ELSE 0 END), 0) as menunggu,
           COALESCE(SUM(CASE WHEN status IN ('dikonfirmasi', 'hadir') THEN 1 ELSE 0 END), 0) as dikonfirmasi,
           COALESCE(SUM(CASE WHEN status = 'ditolak' THEN 1 ELSE 0 END), 0) as ditolak,
           COALESCE(SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END), 0) as sudah_hadir,
           COALESCE(SUM(CASE WHEN status = 'dikonfirmasi' THEN 1 ELSE 0 END), 0) as belum_hadir
         FROM pendaftar`
      )
      .first<{
        total: number;
        menunggu: number;
        dikonfirmasi: number;
        ditolak: number;
        sudah_hadir: number;
        belum_hadir: number;
      }>();

    const total = stats?.total || 0;
    const menunggu = stats?.menunggu || 0;
    const dikonfirmasi = stats?.dikonfirmasi || 0;
    const ditolak = stats?.ditolak || 0;
    const sudah_hadir = stats?.sudah_hadir || 0;
    const belum_hadir = stats?.belum_hadir || Math.max(0, dikonfirmasi - sudah_hadir);
    const persentase_kehadiran = dikonfirmasi > 0
      ? Math.min(100, Math.max(0, Math.round((sudah_hadir / dikonfirmasi) * 100)))
      : 0;

    return c.json({
      total,
      menunggu,
      dikonfirmasi,
      ditolak,
      hadir: sudah_hadir,
      sudah_hadir,
      belum_hadir,
      persentase_kehadiran,
    });
  } catch (err: any) {
    console.error('Error stats absensi:', err);
    return c.json({ error: 'Gagal memuat statistik: ' + err.message }, 500);
  }
});

/**
 * POST /api/absensi/lookup
 * Mencari dan menampilkan preview data peserta berdasarkan token QR tanpa mengubah statusnya
 */
absensiRoutes.post('/lookup', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const body = await c.req.json().catch(() => ({}));
  const token = (body.token as string)?.trim();

  if (!token) {
    return c.json({ error: 'Kode token QR wajib dikirim' }, 400);
  }

  try {
    const pendaftar = await db
      .prepare(
        `SELECT id, nama, email, no_whatsapp, instansi, status, qr_token, attended_at, created_at, confirmed_at, screenshot_url
         FROM pendaftar
         WHERE qr_token = ?`
      )
      .bind(token)
      .first<{
        id: string;
        nama: string;
        email: string;
        no_whatsapp: string;
        instansi: string;
        status: string;
        qr_token: string;
        attended_at: string | null;
        created_at: string;
        confirmed_at: string | null;
        screenshot_url: string | null;
      }>();

    if (!pendaftar) {
      return c.json({ error: 'QR Code tidak terdaftar / tidak valid!' }, 404);
    }

    return c.json({
      success: true,
      data: pendaftar,
    });
  } catch (err: any) {
    return c.json({ error: 'Gagal mencari data QR: ' + err.message }, 500);
  }
});

/**
 * POST /api/absensi/scan
 * Validasi QR code kehadiran saat di-scan oleh kamera HP panitia
 */
absensiRoutes.post('/scan', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const body = await c.req.json().catch(() => ({}));
  const token = (body.token as string)?.trim();

  if (!token) {
    return c.json({ error: 'Kode token QR wajib dikirim' }, 400);
  }

  try {
    const pendaftar = await db
      .prepare(
        `SELECT id, nama, no_whatsapp, instansi, status, qr_token, attended_at
         FROM pendaftar
         WHERE qr_token = ?`
      )
      .bind(token)
      .first<{
        id: string;
        nama: string;
        no_whatsapp: string;
        instansi: string;
        status: string;
        qr_token: string;
        attended_at: string | null;
      }>();

    if (!pendaftar) {
      return c.json({ error: 'QR Code tidak terdaftar / tidak valid!' }, 404);
    }

    if (pendaftar.status === 'menunggu') {
      return c.json(
        {
          error: 'Pendaftar belum dikonfirmasi oleh panitia.',
          nama: pendaftar.nama,
          status: pendaftar.status,
        },
        400
      );
    }

    if (pendaftar.status === 'ditolak') {
      return c.json(
        {
          error: 'Status pendaftaran ditolak oleh panitia.',
          nama: pendaftar.nama,
          status: pendaftar.status,
        },
        400
      );
    }

    if (pendaftar.status === 'hadir') {
      return c.json(
        {
          error: 'Peserta sudah tercatat hadir sebelumnya!',
          nama: pendaftar.nama,
          instansi: pendaftar.instansi,
          attended_at: pendaftar.attended_at,
          status: 'hadir',
        },
        409
      );
    }

    // Status 'dikonfirmasi' -> Ubah status menjadi 'hadir'
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE pendaftar
         SET status = 'hadir',
             attended_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(pendaftar.id)
      .run();

    return c.json({
      success: true,
      message: `Presensi Berhasil: Selamat Datang, ${pendaftar.nama}!`,
      nama: pendaftar.nama,
      instansi: pendaftar.instansi,
      attended_at: now,
      status: 'hadir',
    });
  } catch (err: any) {
    console.error('Error scan kehadiran:', err);
    return c.json({ error: 'Gagal memproses validasi kehadiran: ' + err.message }, 500);
  }
});
