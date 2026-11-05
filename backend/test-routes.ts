import app from './src/index';

// Simple in-memory mock for Cloudflare D1
class MockD1Database {
  private pendaftar: any[] = [];
  private adminUsers: any[] = [
    {
      id: 'admin_default',
      username: 'admin',
      password_hash: 'admin123',
      nama: 'Administrator',
      role: 'panitia',
    },
  ];

  prepare(query: string) {
    const normalized = query.replace(/\s+/g, ' ').trim();
    return {
      bind: (...params: any[]) => {
        return {
          first: async <T = any>(): Promise<T | null> => {
            if (normalized.includes('WHERE no_whatsapp = ? OR no_whatsapp = ?') || normalized.includes('WHERE (no_whatsapp = ? OR no_whatsapp = ?)')) {
              const res = this.pendaftar.find(
                (p) => (p.no_whatsapp === params[0] || p.no_whatsapp === params[1]) && p.status !== 'ditolak'
              );
              return (res as T) || null;
            }
            if (normalized.includes('WHERE id = ?')) {
              const res = this.pendaftar.find((p) => p.id === params[0]);
              return (res as T) || null;
            }
            if (normalized.includes('WHERE qr_token = ?')) {
              const res = this.pendaftar.find((p) => p.qr_token === params[0]);
              return (res as T) || null;
            }
            if (normalized.includes('WHERE username = ?')) {
              const res = this.adminUsers.find((u) => u.username === params[0]);
              return (res as T) || null;
            }
            if (normalized.includes('COUNT(*) as total')) {
              const total = this.pendaftar.length;
              const menunggu = this.pendaftar.filter((p) => p.status === 'menunggu').length;
              const dikonfirmasi = this.pendaftar.filter((p) => p.status === 'dikonfirmasi').length;
              const hadir = this.pendaftar.filter((p) => p.status === 'hadir').length;
              const ditolak = this.pendaftar.filter((p) => p.status === 'ditolak').length;
              return { total, menunggu, dikonfirmasi, hadir, ditolak } as T;
            }
            return null;
          },
          all: async <T = any>(): Promise<{ results: T[] }> => {
            let res = [...this.pendaftar];
            if (normalized.includes('status = ?')) {
              const status = params[0];
              res = res.filter((p) => p.status === status);
            }
            return { results: res as T[] };
          },
          run: async () => {
            if (normalized.includes('INSERT INTO pendaftar')) {
              const [id, nama, email, no_whatsapp, instansi, screenshot_url] = params;
              this.pendaftar.push({
                id,
                nama,
                email,
                no_whatsapp,
                instansi,
                screenshot_url,
                qr_token: null,
                qr_code_url: null,
                status: 'menunggu',
                alasan_tolak: null,
                wa_terkirim: 0,
                created_at: new Date().toISOString(),
                confirmed_at: null,
                attended_at: null,
              });
            } else if (normalized.includes("SET status = 'dikonfirmasi'")) {
              const [qrToken, qrCodeUrl, id] = params;
              const target = this.pendaftar.find((p) => p.id === id);
              if (target) {
                target.status = 'dikonfirmasi';
                target.qr_token = qrToken;
                target.qr_code_url = qrCodeUrl;
                target.confirmed_at = new Date().toISOString();
              }
            } else if (normalized.includes("SET status = 'hadir'")) {
              const [id] = params;
              const target = this.pendaftar.find((p) => p.id === id);
              if (target) {
                target.status = 'hadir';
                target.attended_at = new Date().toISOString();
              }
            } else if (normalized.includes("SET status = 'ditolak'")) {
              const [alasan, id] = params;
              const target = this.pendaftar.find((p) => p.id === id);
              if (target) {
                target.status = 'ditolak';
                target.alasan_tolak = alasan;
              }
            } else if (normalized.includes('SET wa_terkirim = 1')) {
              const [id] = params;
              const target = this.pendaftar.find((p) => p.id === id);
              if (target) target.wa_terkirim = 1;
            } else if (normalized.includes('DELETE FROM pendaftar WHERE id = ?')) {
              const [id] = params;
              this.pendaftar = this.pendaftar.filter((p) => p.id !== id);
            }
            return { success: true };
          },
        };
      },
      all: async <T = any>(): Promise<{ results: T[] }> => {
        return { results: [...this.pendaftar] as T[] };
      },
      first: async <T = any>(): Promise<T | null> => {
        if (normalized.includes('COUNT(*) as total')) {
          const total = this.pendaftar.length;
          const menunggu = this.pendaftar.filter((p) => p.status === 'menunggu').length;
          const dikonfirmasi = this.pendaftar.filter((p) => p.status === 'dikonfirmasi').length;
          const hadir = this.pendaftar.filter((p) => p.status === 'hadir').length;
          const ditolak = this.pendaftar.filter((p) => p.status === 'ditolak').length;
          return { total, menunggu, dikonfirmasi, hadir, ditolak } as T;
        }
        return (this.pendaftar[0] as T) || null;
      },
    };
  }
}

// Simple in-memory mock for Cloudflare R2
class MockR2Bucket {
  private files = new Map<string, { data: Uint8Array; contentType: string }>();

  async put(key: string, data: any, options?: any) {
    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (data instanceof Uint8Array) bytes = data;
    else bytes = new TextEncoder().encode(String(data));
    this.files.set(key, { data: bytes, contentType: options?.httpMetadata?.contentType || 'application/octet-stream' });
    return {};
  }

  async get(key: string) {
    const item = this.files.get(key);
    if (!item) return null;
    return {
      body: item.data,
      httpMetadata: { contentType: item.contentType },
    };
  }

  async delete(key: string) {
    this.files.delete(key);
  }
}

async function runTests() {
  console.log('--- Memulai Test Suite Backend MS EvenScan ---');

  const mockDb = new MockD1Database();
  const mockStorage = new MockR2Bucket();
  const env = {
    DB: mockDb as any,
    STORAGE: mockStorage as any,
    JWT_SECRET: 'super-secret-test-key-2026',
    ENVIRONMENT: 'test',
  };

  // 1. Health check
  console.log('1. Test GET / (Health check)');
  const res1 = await app.request('/', {}, env);
  const json1 = await res1.json();
  console.log('   Response:', json1);
  if (json1.status !== 'ok') throw new Error('Health check failed');

  // 2. Pendaftaran
  console.log('\n2. Test POST /api/peserta/daftar');
  const formData = new FormData();
  formData.append('nama', 'Muhammad Bilal');
  formData.append('email', 'bilal@muslimscene.id');
  formData.append('no_whatsapp', '081234567890');
  formData.append('instansi', 'Komunitas Muslim Scene');

  const dummyImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const dummyFile = new File([dummyImageBytes], 'bukti_transfer.jpg', { type: 'image/jpeg' });
  formData.append('screenshot', dummyFile);

  const res2 = await app.request('/api/peserta/daftar', { method: 'POST', body: formData }, env);
  const json2 = await res2.json();
  console.log('   Status:', res2.status);
  console.log('   Response:', json2);
  if (!json2.success) throw new Error('Daftar failed: ' + JSON.stringify(json2));
  const pesertaId = json2.id;

  // 2b. Test Deduplikasi (Cegah Pendaftaran Ganda)
  console.log('\n2b. Test Cegah Duplikasi POST /api/peserta/daftar');
  const res2b = await app.request('/api/peserta/daftar', { method: 'POST', body: formData }, env);
  const json2b = await res2b.json();
  console.log('   Status (harus 200 dengan id yang sama):', res2b.status);
  console.log('   Response:', json2b);
  if (json2b.id !== pesertaId) throw new Error('Deduplikasi gagal: ID tidak cocok');

  // 3. Cek Status Peserta
  console.log('\n3. Test GET /api/peserta/status?wa=081234567890');
  const res3 = await app.request('/api/peserta/status?wa=081234567890', {}, env);
  const json3 = await res3.json();
  console.log('   Status:', res3.status);
  console.log('   Response:', json3);
  if (json3.nama !== 'Muhammad Bilal' || json3.status !== 'menunggu') throw new Error('Cek status failed');

  // 4. Login Admin
  console.log('\n4. Test POST /api/admin/login');
  const res4 = await app.request(
    '/api/admin/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    },
    env
  );
  const json4 = await res4.json();
  console.log('   Status:', res4.status);
  console.log('   Token:', json4.token ? json4.token.substring(0, 30) + '...' : 'none');
  if (!json4.token) throw new Error('Login failed');
  const adminToken = json4.token;

  // 5. Admin List Pendaftar
  console.log('\n5. Test GET /api/admin/pendaftar');
  const res5 = await app.request(
    '/api/admin/pendaftar',
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    env
  );
  const json5 = await res5.json();
  console.log('   Total pendaftar:', json5.total);
  if (json5.total < 1) throw new Error('List pendaftar empty');

  // 6. Konfirmasi Pendaftar
  console.log(`\n6. Test PATCH /api/admin/pendaftar/${pesertaId}/konfirmasi`);
  const res6 = await app.request(
    `/api/admin/pendaftar/${pesertaId}/konfirmasi`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, Origin: 'http://localhost:3001' },
    },
    env
  );
  const json6 = await res6.json();
  console.log('   Status:', res6.status);
  console.log('   QR Token:', json6.qr_token);
  console.log('   WhatsApp Link:', json6.wa_url);
  if (!json6.qr_token || !json6.wa_url) throw new Error('Konfirmasi failed');
  const qrToken = json6.qr_token;

  // 7. Generate & Download QR PNG
  console.log(`\n7. Test GET /api/peserta/qr/${qrToken}`);
  const res7 = await app.request(`/api/peserta/qr/${qrToken}`, {}, env);
  console.log('   Status:', res7.status);
  console.log('   Content-Type:', res7.headers.get('Content-Type'));
  if (res7.headers.get('Content-Type') !== 'image/png') throw new Error('QR PNG generation failed');

  // 8. Scan Absensi (Presensi Kehadiran)
  console.log('\n8. Test POST /api/absensi/scan');
  const res8 = await app.request(
    '/api/absensi/scan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrToken }),
    },
    env
  );
  const json8 = await res8.json();
  console.log('   Status:', res8.status);
  console.log('   Response:', json8);
  if (!json8.success || json8.status !== 'hadir') throw new Error('Scan absensi failed');

  // 9. Re-scan Absensi (Deteksi Duplikasi)
  console.log('\n9. Test Re-scan Duplikat POST /api/absensi/scan');
  const res9 = await app.request(
    '/api/absensi/scan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrToken }),
    },
    env
  );
  console.log('   Status (harus 409 Conflict):', res9.status);
  if (res9.status !== 409) throw new Error('Duplicate check failed');

  // 10. Statistik Kehadiran
  console.log('\n10. Test GET /api/absensi/stats');
  const res10 = await app.request('/api/absensi/stats', {}, env);
  const json10 = await res10.json();
  console.log('   Stats:', json10);
  if (json10.hadir !== 1) throw new Error('Stats calculation failed');

  // 11. Hapus Pendaftar (Admin DELETE)
  console.log('\n11. Test DELETE /api/admin/pendaftar/:id');
  const res11 = await app.request(
    `/api/admin/pendaftar/${pesertaId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    env
  );
  console.log('   Status:', res11.status);
  const json11 = await res11.json();
  console.log('   Response:', json11);
  if (res11.status !== 200 || !json11.success) throw new Error('Delete pendaftar failed');

  console.log('\n🎉 SEMUA 11 PENGUJIAN INTEGRASI TAHAP 2 BERHASIL 100%!');
}

runTests().catch((err) => {
  console.error('\n❌ TEST GAGAL:', err);
  process.exit(1);
});
