import { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';

export interface AdminJwtPayload extends JWTPayload {
  id: string;
  username: string;
  nama: string;
  role: string;
  exp: number;
}

/**
 * Membuat JWT token untuk admin yang berhasil login
 */
export async function createAdminToken(
  user: { id: string; username: string; nama: string; role: string },
  secret: string
): Promise<string> {
  const payload: AdminJwtPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 hari
  };
  return await sign(payload, secret, 'HS256');
}

/**
 * Middleware untuk memverifikasi JWT token pada endpoint khusus admin
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Akses ditolak: Token otentikasi tidak ditemukan' }, 401);
  }

  const token = authHeader.substring(7).trim();
  const secret = c.env.JWT_SECRET || 'dev-secret-key-12345';

  try {
    const payload = (await verify(token, secret, 'HS256')) as unknown as AdminJwtPayload;
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Akses ditolak: Token tidak valid atau telah kedaluwarsa' }, 401);
  }
}
