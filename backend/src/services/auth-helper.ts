/**
 * Helper otentikasi & hash password menggunakan Web Crypto API
 * Standar kompatibel dengan Cloudflare Workers & Node.js
 */

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':ms_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === expectedHash;
}

