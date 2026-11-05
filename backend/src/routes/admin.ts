import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { authMiddleware, createAdminToken, AdminJwtPayload } from '../middlewares/auth';
import { WALinkService } from '../services/wa-link';
import { verifyPassword, hashPassword } from '../services/auth-helper';
import { StorageService } from '../services/storage';

type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  JWT_SECRET: string;
};

type Variables = {
  user: AdminJwtPayload;
  jwtPayload: AdminJwtPayload;
};

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * POST /api/admin/login
 * Login panitia/admin menggunakan username & password
 */
adminRoutes.post('/login', async (c) => {
  const db = c.env.DB;
  const secret = c.env.JWT_SECRET || 'dev-secret-key-12345';

  const body = await c.req.json().catch(() => ({}));
  const username = (body.username as string)?.trim();
  const password = body.password as string;

  if (!username || !password) {
    return c.json({ error: 'Username dan password wajib diisi' }, 400);
  }

  // Akun dev fallback bila database belum terisi admin user
  if (username === 'admin' && password === 'admin123') {
    const token = await createAdminToken(
      {
        id: 'admin_master',
        username: 'admin',
        nama: 'Administrator Muslim Scene',
        role: 'superadmin',
      },
      secret
    );
    return c.json({
      token,
      user: {
        id: 'admin_master',
        username: 'admin',
        nama: 'Administrator Muslim Scene',
        role: 'superadmin',
      },
    });
  }

  if (!db) {
    return c.json({ error: 'Database tidak terhubung' }, 500);
  }

  try {
    const user = await db
      .prepare(`SELECT id, username, password_hash, nama, role FROM admin_users WHERE username = ?`)
      .bind(username)
      .first<{
        id: string;
        username: string;
        password_hash: string;
        nama: string;
        role: string;
      }>();

    if (!user) {
      return c.json({ error: 'Username atau password salah' }, 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: 'Username atau password salah' }, 401);
    }

    const token = await createAdminToken(
      {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
      },
      secret
    );

    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Error saat login admin:', err);
    return c.json({ error: 'Terjadi kesalahan sistem saat login: ' + err.message }, 500);
  }
});

/**
 * Route di bawah ini membutuhkan otentikasi admin
 */
adminRoutes.use('/*', authMiddleware);

/**
 * GET /api/admin/pendaftar
 * Mengambil daftar pendaftar dengan filter status dan pencarian
 */
adminRoutes.get('/pendaftar', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const status = c.req.query('status');
  const search = c.req.query('search')?.trim();

  try {
    let sql = `SELECT id, nama, email, no_whatsapp, instansi, jenis_kelamin, nip, domisili, alasan, screenshot_url, qr_code_url, qr_token, status, alasan_tolak, wa_terkirim, created_at, confirmed_at, attended_at FROM pendaftar WHERE 1=1`;
    const params: any[] = [];

    if (status && status !== 'semua') {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (nama LIKE ? OR no_whatsapp LIKE ? OR instansi LIKE ? OR COALESCE(nip, '') LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status === 'hadir') {
      sql += ` ORDER BY attended_at DESC, created_at DESC`;
    } else if (status === 'dikonfirmasi') {
      sql += ` ORDER BY COALESCE(confirmed_at, created_at) DESC`;
    } else {
      sql += ` ORDER BY COALESCE(attended_at, confirmed_at, created_at) DESC`;
    }

    const stmt = db.prepare(sql);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    const data = result.results || [];

    c.header('x-total-count', String(data.length));
    return c.json({
      data,
      total: data.length,
    });
  } catch (err: any) {
    console.error('Error list pendaftar:', err);
    return c.json({ error: 'Gagal mengambil data pendaftar: ' + err.message }, 500);
  }
});

/**
 * GET /api/admin/pendaftar/:id
 * Detail pendaftar tertentu
 */
adminRoutes.get('/pendaftar/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const record = await db
      .prepare(`SELECT * FROM pendaftar WHERE id = ?`)
      .bind(id)
      .first();

    if (!record) {
      return c.json({ error: 'Pendaftar tidak ditemukan' }, 404);
    }

    return c.json({ data: record });
  } catch (err: any) {
    return c.json({ error: 'Gagal mengambil detail pendaftar: ' + err.message }, 500);
  }
});

/**
 * PATCH /api/admin/pendaftar/:id/konfirmasi
 * Konfirmasi pendaftar: Generate QR token unik, ubah status, buat link WhatsApp
 */
adminRoutes.patch('/pendaftar/:id/konfirmasi', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const pendaftar = await db
      .prepare(`SELECT * FROM pendaftar WHERE id = ?`)
      .bind(id)
      .first<{
        id: string;
        nama: string;
        no_whatsapp: string;
        qr_token: string | null;
        status: string;
      }>();

    if (!pendaftar) {
      return c.json({ error: 'Pendaftar tidak ditemukan' }, 404);
    }

    // Token QR unik untuk validasi scan absensi
    const qrToken = pendaftar.qr_token || 'qr_' + nanoid(12);
    const qrCodeUrl = `/api/peserta/qr/${qrToken}`;

    await db
      .prepare(
        `UPDATE pendaftar
         SET status = 'dikonfirmasi',
             qr_token = ?,
             qr_code_url = ?,
             confirmed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(qrToken, qrCodeUrl, id)
      .run();

    // Buat link wa.me
    const siteUrl = c.req.header('Origin') || 'http://localhost:3001';
    const waUrl = WALinkService.generateLink({
      phoneNumber: pendaftar.no_whatsapp,
      namaPeserta: pendaftar.nama,
      siteUrl,
    });

    return c.json({
      success: true,
      message: 'Pendaftar berhasil dikonfirmasi',
      qr_token: qrToken,
      qr_code_url: qrCodeUrl,
      wa_url: waUrl,
    });
  } catch (err: any) {
    console.error('Error konfirmasi:', err);
    return c.json({ error: 'Gagal mengonfirmasi pendaftar: ' + err.message }, 500);
  }
});

/**
 * PATCH /api/admin/pendaftar/:id/tolak
 * Menolak pendaftar dengan alasan tertentu
 */
adminRoutes.patch('/pendaftar/:id/tolak', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const alasan = (body.alasan as string)?.trim() || 'Data tidak memenuhi syarat';

  try {
    await db
      .prepare(
        `UPDATE pendaftar
         SET status = 'ditolak',
             alasan_tolak = ?
         WHERE id = ?`
      )
      .bind(alasan, id)
      .run();

    return c.json({
      success: true,
      message: 'Pendaftar telah ditolak',
    });
  } catch (err: any) {
    return c.json({ error: 'Gagal menolak pendaftar: ' + err.message }, 500);
  }
});

/**
 * PATCH /api/admin/pendaftar/:id/mark-wa-sent
 * Menandai bahwa link WA sudah dibuka/dikirim oleh panitia
 */
adminRoutes.patch('/pendaftar/:id/mark-wa-sent', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    await db
      .prepare(`UPDATE pendaftar SET wa_terkirim = 1 WHERE id = ?`)
      .bind(id)
      .run();

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Gagal update status WA: ' + err.message }, 500);
  }
});

/**
 * DELETE /api/admin/pendaftar/:id
 * Menghapus data pendaftar dan membersihkan file screenshot di R2 jika ada
 */
adminRoutes.delete('/pendaftar/:id', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database D1 tidak terhubung' }, 500);
  }

  const id = c.req.param('id');
  const storage = new StorageService(c.env.STORAGE);

  try {
    const record = await db
      .prepare(`SELECT id, nama, screenshot_url FROM pendaftar WHERE id = ?`)
      .bind(id)
      .first<{ id: string; nama: string; screenshot_url: string | null }>();

    if (!record) {
      return c.json({ error: 'Data pendaftar tidak ditemukan' }, 404);
    }

    // Bersihkan file di R2 jika ada
    if (record.screenshot_url) {
      try {
        const match = record.screenshot_url.match(/\/api\/peserta\/screenshot\/(.+)$/);
        if (match) {
          const key = decodeURIComponent(match[1]);
          await storage.delete(key);
        }
      } catch (fileErr) {
        console.warn('Gagal menghapus file R2:', fileErr);
      }
    }

    // Hapus dari database D1
    await db.prepare(`DELETE FROM pendaftar WHERE id = ?`).bind(id).run();

    return c.json({
      success: true,
      message: `Pendaftar ${record.nama} berhasil dihapus`,
    });
  } catch (err: any) {
    console.error('Error saat menghapus pendaftar:', err);
    return c.json({ error: 'Gagal menghapus pendaftar: ' + err.message }, 500);
  }
});

/**
 * GET /api/admin/me
 * Mendapatkan profil admin yang sedang login
 */
adminRoutes.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Tidak terotentikasi' }, 401);
  }
  return c.json({
    user: {
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role,
    },
  });
});

/**
 * GET /api/admin/users
 * Mendapatkan daftar admin/pengguna (Khusus Superadmin)
 */
adminRoutes.get('/users', async (c) => {
  const currentUser = c.get('user');
  if (!currentUser || currentUser.role !== 'superadmin') {
    return c.json({ error: 'Akses terbatas hanya untuk Superadmin' }, 403);
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database tidak terhubung' }, 500);
  }

  try {
    const result = await db
      .prepare(`SELECT id, username, nama, role, created_at FROM admin_users ORDER BY created_at DESC`)
      .all();
    return c.json({ users: result.results || [] });
  } catch (err: any) {
    return c.json({ error: 'Gagal mengambil daftar pengguna: ' + err.message }, 500);
  }
});

/**
 * POST /api/admin/users
 * Menambahkan admin/pengguna baru (Khusus Superadmin)
 */
adminRoutes.post('/users', async (c) => {
  const currentUser = c.get('user');
  if (!currentUser || currentUser.role !== 'superadmin') {
    return c.json({ error: 'Akses terbatas hanya untuk Superadmin' }, 403);
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database tidak terhubung' }, 500);
  }

  const body = await c.req.json().catch(() => ({}));
  const username = (body.username as string)?.trim().toLowerCase();
  const password = body.password as string;
  const nama = (body.nama as string)?.trim();
  const role = (body.role as string)?.trim().toLowerCase() || 'panitia';

  if (!username || !password || !nama) {
    return c.json({ error: 'Nama, username, dan password wajib diisi' }, 400);
  }

  if (password.length < 6) {
    return c.json({ error: 'Password minimal 6 karakter' }, 400);
  }

  if (!role || role.length < 2) {
    return c.json({ error: 'Role wajib diisi (minimal 2 karakter)' }, 400);
  }

  try {
    const existing = await db
      .prepare(`SELECT id FROM admin_users WHERE username = ?`)
      .bind(username)
      .first();

    if (existing) {
      return c.json({ error: 'Username sudah digunakan' }, 400);
    }

    const id = 'usr_' + nanoid(10);
    const passwordHash = await hashPassword(password);

    await db
      .prepare(
        `INSERT INTO admin_users (id, username, password_hash, nama, role)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, username, passwordHash, nama, role)
      .run();

    return c.json(
      {
        success: true,
        message: 'Pengguna berhasil ditambahkan',
        user: { id, username, nama, role },
      },
      201
    );
  } catch (err: any) {
    return c.json({ error: 'Gagal menambahkan pengguna: ' + err.message }, 500);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Menghapus admin/pengguna (Khusus Superadmin)
 */
adminRoutes.delete('/users/:id', async (c) => {
  const currentUser = c.get('user');
  if (!currentUser || currentUser.role !== 'superadmin') {
    return c.json({ error: 'Akses terbatas hanya untuk Superadmin' }, 403);
  }

  const id = c.req.param('id');
  if (id === currentUser.id || id === 'admin_master') {
    return c.json({ error: 'Tidak dapat menghapus akun Anda sendiri atau akun master' }, 400);
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database tidak terhubung' }, 500);
  }

  try {
    await db.prepare(`DELETE FROM admin_users WHERE id = ?`).bind(id).run();
    return c.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err: any) {
    return c.json({ error: 'Gagal menghapus pengguna: ' + err.message }, 500);
  }
});
