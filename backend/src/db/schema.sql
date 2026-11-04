-- Tabel pendaftar
CREATE TABLE IF NOT EXISTS pendaftar (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    email TEXT,
    no_whatsapp TEXT NOT NULL,
    instansi TEXT,
    screenshot_url TEXT,
    qr_code_url TEXT,
    qr_token TEXT UNIQUE,
    status TEXT DEFAULT 'menunggu' CHECK(status IN ('menunggu', 'dikonfirmasi', 'ditolak', 'hadir')),
    alasan_tolak TEXT,
    wa_terkirim INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    attended_at DATETIME
);

-- Tabel admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT DEFAULT 'panitia',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_pendaftar_status ON pendaftar(status);
CREATE INDEX IF NOT EXISTS idx_pendaftar_wa ON pendaftar(no_whatsapp);
CREATE INDEX IF NOT EXISTS idx_pendaftar_qr_token ON pendaftar(qr_token);
