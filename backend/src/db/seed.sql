-- Seed default data untuk admin
INSERT OR IGNORE INTO admin_users (id, username, password_hash, nama, role)
VALUES (
    'admin_default',
    'admin',
    'admin123', -- Catatan: endpoint login juga memiliki fallback bawaan untuk user 'admin' & 'admin123'
    'Administrator Panitia',
    'panitia'
);

-- Contoh data pendaftar simulasi untuk testing
INSERT OR IGNORE INTO pendaftar (id, nama, email, no_whatsapp, instansi, screenshot_url, qr_token, status, wa_terkirim)
VALUES 
(
    'reg_demo_001',
    'Ahmad Fauzi',
    'ahmad@example.com',
    '081234567890',
    'Komunitas Muslim Scene',
    '/api/peserta/screenshot/demo.jpg',
    'qr_demo_token_123',
    'dikonfirmasi',
    0
),
(
    'reg_demo_002',
    'Siti Nurhaliza',
    'siti@example.com',
    '089876543210',
    'Universitas Indonesia',
    '/api/peserta/screenshot/demo.jpg',
    NULL,
    'menunggu',
    0
);

